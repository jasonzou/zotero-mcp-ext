#!/bin/bash

# MCP Tools Test Script
# Tests all 5 MCP tools: get_item_abstract, get_item_citation, upload_pdf_and_create_item,
# enrich_item_from_pdf, extract_pdf_metadata

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MCP_ENDPOINT="http://127.0.0.1:23120/mcp"
TIMEOUT=30

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is required but not installed${NC}"
    exit 1
fi

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    exit 1
fi

# Function to print test header
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}Testing: $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Function to send MCP request
send_mcp_request() {
    local method="$1"
    local params="$2"
    local request_id="$3"

    local json_payload=$(cat <<EOF
{
    "jsonrpc": "2.0",
    "id": "${request_id}",
    "method": "${method}",
    "params": ${params}
}
EOF
)

    echo "Request: $json_payload" >&2

    response=$(curl -s -X POST "$MCP_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Accept: application/json" \
        --max-time "$TIMEOUT" \
        -d "$json_payload")

    echo "$response"
}

# Function to check if MCP server is running
check_server() {
    print_header "Checking MCP Server Status"

    response=$(curl -s -X GET "http://127.0.0.1:23120/mcp/status" \
        -H "Accept: application/json" \
        --max-time 5)

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        print_error "MCP server is not running or not accessible"
        echo "Error: $(echo "$response" | jq -r '.error')"
        exit 1
    fi

    print_info "Server info:"
    echo "$response" | jq '.'
    print_success "MCP server is running"
}

# Test 1: get_item_abstract
test_get_item_abstract() {
    print_header "Tool 1/5: get_item_abstract"

    # Need a valid item key - this should be provided or found first
    print_info "ontology... "

    # First, let's search for an item to get a real item key
    search_response=$(send_mcp_request "tools/call" '
{
    "name": "search_library",
    "arguments": {
        "limit": 1
    }
}' "ontology")

    if echo "$search_response" | jq -e '.error' > /dev/null 2>&1; then
        print_error "Failed to search for items"
        echo "Error: $(echo "$search_response" | jq -r '.error')"
        return 1
    fi

    item_key=$(echo "$search_response" | jq -r '.result.results[0].key' 2>/dev/null)

    if [ "$item_key" = "null" ] || [ -z "$item_key" ]; then
        print_info "No items found in library, using placeholder"
        item_key="ABCD1234"
    fi

    print_info "Testing get_item_abstract with item: $item_key"

    response=$(send_mcp_request "tools/call" "
{
    \"name\": \"get_item_abstract\",
    \"arguments\": {
        \"itemKey\": \"$item_key\",
        \"format\": \"json\"
    }
}
" "test-abstract-$item_key")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        print_error "get_item_abstract failed"
        echo "Error: $(echo "$response" | jq -r '.error')"
        return 1
    fi

    print_info "Response received:"
    echo "$response" | jq '.'
    print_success "get_item_abstract test completed"
}

# Test 2: get_item_citation
test_get_item_citation() {
    print_header "Tool 2/5: get_item_citation"

    # Need a valid item key
    print_info "Testing with sample item key..."

    # Search for an item
    search_response=$(send_mcp_request "tools/call" '
{
    "name": "search_library",
    "arguments": {
        "limit": 1
    }
}' "search-for-citation-item")

    item_key=$(echo "$search_response" | jq -r '.result.results[0].key' 2>/dev/null)

    if [ "$item_key" = "null" ] || [ -z "$item_key" ]; then
        print_info "No items found, testing with placeholder"
        item_key="ABCD1234"
    fi

    print_info "Testing get_item_citation with different styles..."

    # Test APA style
    print_info "Testing APA style..."
    response=$(send_mcp_request "tools/call" "
{
    \"name\": \"get_item_citation\",
    \"arguments\": {
        \"itemKey\": \"$item_key\",
        \"style\": \"apa\",
        \"format\": \"text\"
    }
}
" "test-citation-apa-$item_key")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        print_error "get_item_citation (APA) failed"
        echo "Error: $(echo "$response" | jq -r '.error')"
    else
        print_info "APA Citation:"
        echo "$response" | jq -r '.result.citation // .result // empty' 2>/dev/null || echo "$response" | jq '.'
    fi

    # Test BibTeX format
    print_info "Testing BibTeX format..."
    response=$(send_mcp_request "tools/call" "
{
    \"name\": \"get_item_citation\",
    \"arguments\": {
        \"itemKey\": \"$item_key\",
        \"style\": \"bibtex\",
        \"format\": \"bibtex\"
    }
}
" "test-citation-bibtex-$item_key")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        print_error "get_item_citation (BibTeX) failed"
        echo "Error: $(echo "$response" | jq -r '.error')"
    else
        print_info "BibTeX Entry:"
        echo "$response" | jq -r '.result.citation // .result // empty' 2>/dev/null || echo "$response" | jq '.'
    fi

    print_success "get_item_citation test completed"
}

# Test 3: upload_pdf_and_create_item
test_upload_pdf_and_create_item() {
    print_header "Tool 3/5: upload_pdf_and_create_item"

    print_info "This test requires a PDF file path"

    # Check if PDF path is provided as argument
    if [ -n "$1" ]; then
        pdf_path="$1"
        print_info "Using provided PDF path: $pdf_path"
    elif [ -f "./test.pdf" ]; then
        pdf_path="$(pwd)/test.pdf"
        print_info "Found test.pdf in current directory: $pdf_path"
    else
        print_info "No PDF file provided or found. Please provide a PDF file path to test this tool."
        print_info "Usage: $0 /path/to/document.pdf"

        # Show example request without actually calling it
        echo ""
        echo "Example request:"
        cat << 'EOF'
{
    "jsonrpc": "2.0",
    "id": "test-upload-pdf",
    "method": "tools/call",
    "params": {
        "name": "upload_pdf_and_create_item",
        "arguments": {
            "pdfPath": "/absolute/path/to/document.pdf",
            "useWebService": true,
            "extractPDFProperties": true
        }
    }
}
EOF
        print_success "upload_pdf_and_create_item documentation shown (skipping actual test)"
        return 0
    fi

    # Test the upload
    response=$(send_mcp_request "tools/call" "
{
    \"name\": \"upload_pdf_and_create_item\",
    \"arguments\": {
        \"pdfPath\": \"$pdf_path\",
        \"useWebService\": true,
        \"extractPDFProperties\": true
    }
}
" "test-upload-pdf")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        print_error "upload_pdf_and_create_item failed"
        echo "Error: $(echo "$response" | jq -r '.error')"
        return 1
    fi

    print_info "Upload successful! Response:"
    echo "$response" | jq '.'
    print_success "upload_pdf_and_create_item test completed"
}

# Test 4: enrich_item_from_pdf
test_enrich_item_from_pdf() {
    print_header "Tool 4/5: enrich_item_from_pdf"

    print_info "This test enriches an existing item from its PDF attachment"

    # First, find an item that has PDF attachments
    search_response=$(send_mcp_request "tools/call" '
{
    "name": "search_library",
    "arguments": {
        "limit": 5
    }
}' "search-for-item-to-enrich")

    # Find an item with PDF attachments
    local item_with_pdf=""
    local item_key=""

    if echo "$search_response" | jq -e '.result.results' > /dev/null 2>&1; then
        while IFS= read -r item; do
            item_key=$(echo "$item" | jq -r '.key')
            # Check if item has PDF attachments
            item_details=$(send_mcp_request "tools/call" "
{
    \"name\": \"get_item_details\",
    \"arguments\": {
        \"itemKey\": \"$item_key\"
    }
}" "check-item-$item_key")

            has_pdf=$(echo "$item_details" | jq '.result.attachments // [] | map(select(.contentType == "application/pdf")) | length')

            if [ "$has_pdf" -gt 0 ]; then
                item_with_pdf="$item_key"
                break
            fi
        done < <(echo "$search_response" | jq -c '.result.results[]' 2>/dev/null)
    fi

    if [ -z "$item_with_pdf" ]; then
        print_info "No items with PDF attachments found in the library"
        print_info "To test this tool, ensure you have items with PDF attachments"

        # Show example
        echo ""
        echo "Example request:"
        cat << 'EOF'
{
    "jsonrpc": "2.0",
    "id": "test-enrich-pdf",
    "method": "tools/call",
    "params": {
        "name": "enrich_item_from_pdf",
        "arguments": {
            "itemKey": "ITEM_KEY_HERE",
            "useWebService": true,
            "extractPDFProperties": true,
            "overwriteExisting": false
        }
    }
}
EOF
        print_success "enrich_item_from_pdf documentation shown (skipping actual test)"
        return 0
    fi

    print_info "Found item with PDF: $item_with_pdf"

    response=$(send_mcp_request "tools/call" "
{
    \"name\": \"enrich_item_from_pdf\",
    \"arguments\": {
        \"itemKey\": \"$item_with_pdf\",
        \"useWebService\": true,
        \"extractPDFProperties\": true,
        \"overwriteExisting\": false
    }
}
" "test-enrich-$item_with_pdf")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        print_error "enrich_item_from_pdf failed"
        echo "Error: $(echo "$response" | jq -r '.error')"
        return 1
    fi

    print_info "Enrichment completed! Response:"
    echo "$response" | jq '.'
    print_success "enrich_item_from_pdf test completed"
}

# Test 5: extract_pdf_metadata
test_extract_pdf_metadata() {
    print_header "Tool 5/5: extract_pdf_metadata"

    print_info "This test extracts metadata from a PDF attachment"

    # First, find a PDF attachment
    search_response=$(send_mcp_request "tools/call" '
{
    "name": "search_library",
    "arguments": {
        "limit": 5
    }
}' "search-for-pdf-attachment")

    local pdf_attachment_key=""

    if echo "$search_response" | jq -e '.result.results' > /dev/null 2>&1; then
        while IFS= read -r item; do
            item_key=$(echo "$item" | jq -r '.key')
            # Get item details to find PDF attachments
            item_details=$(send_mcp_request "tools/call" "
{
    \"name\": \"get_item_details\",
    \"arguments\": {
        \"itemKey\": \"$item_key\"
    }
}" "check-item-pdf-$item_key")

            pdf_key=$(echo "$item_details" | jq -r '.result.attachments // [] | map(select(.contentType == "application/pdf")) | .[0].key // empty')

            if [ -n "$pdf_key" ] && [ "$pdf_key" != "null" ]; then
                pdf_attachment_key="$pdf_key"
                break
            fi
        done < <(echo "$search_response" | jq -c '.result.results[]' 2>/dev/null)
    fi

    if [ -z "$pdf_attachment_key" ]; then
        print_info "No PDF attachments found in the library"
        print_info "To test this tool, ensure you have items with PDF attachments"

        # Show example
        echo ""
        echo "Example request:"
        cat << 'EOF'
{
    "jsonrpc": "2.0",
    "id": "test-extract-metadata",
    "method": "tools/call",
    "params": {
        "name": "extract_pdf_metadata",
        "arguments": {
            "attachmentKey": "PDF_ATTACHMENT_KEY_HERE"
        }
    }
}
EOF
        print_success "extract_pdf_metadata documentation shown (skipping actual test)"
        return 0
    fi

    print_info "Found PDF attachment: $pdf_attachment_key"

    response=$(send_mcp_request "tools/call" "
{
    \"name\": \"extract_pdf_metadata\",
    \"arguments\": {
        \"attachmentKey\": \"$pdf_attachment_key\"
    }
}
" "test-extract-$pdf_attachment_key")

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        print_error "extract_pdf_metadata failed"
        echo "Error: $(echo "$response" | jq -r '.error')"
        return 1
    fi

    print_info "Metadata extraction completed! Response:"
    echo "$response" | jq '.'
    print_success "extract_pdf_metadata test completed"
}

# Main execution
main() {
    echo -e "${BLUE}Zotero MCP Tools Test Script${NC}"
    echo "================================="

    # Check if server is running
    check_server

    # Run tests
    test_get_item_abstract
    test_get_item_citation
    test_upload_pdf_and_create_item "$@"
    test_enrich_item_from_pdf
    test_extract_pdf_metadata

    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}All tests completed!${NC}"
    echo -e "${GREEN}========================================${NC}"
}

# Handle interrupt
cleanup() {
    echo -e "\n${YELLOW}Test interrupted by user${NC}"
    exit 1
}
trap cleanup INT

# Run main function with all arguments
main "$@"
