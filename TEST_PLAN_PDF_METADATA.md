# Test Plan: PDF Metadata Extraction & Enrichment MCP Tools

## Overview
This test plan covers the new `upload_pdf_and_create_item` and `enrich_item_from_pdf` MCP tools added to the Zotero MCP ext.

**Version**: 1.2.7
**Date**: 2026-01-05
**Tools Under Test**:
- `upload_pdf_and_create_item`
- `enrich_item_from_pdf`

---

## Test Environment Setup

### Prerequisites
1. **Zotero 7** installed and running
2. **Plugin** installed: `zotero-mcp-ext.xpi` (v1.2.7+)
3. **MCP Server** enabled in plugin preferences
4. **MCP Client** configured (Claude Desktop, Cherry Studio, or Cursor)
5. **Test PDFs** prepared (see Test Data section)

### Test Data Required

#### PDF Samples
1. **Academic Paper with DOI** - Recent journal article with embedded DOI
2. **Academic Paper without DOI** - Older paper or preprint without DOI
3. **Book Chapter** - PDF with ISBN metadata
4. **Technical Report** - PDF with author/title in properties but not published
5. **Scanned PDF** - OCR'd PDF with minimal metadata
6. **Corrupted/Minimal PDF** - PDF with no metadata or damaged metadata
7. **Large PDF** - 50+ MB file to test performance
8. **Non-English PDF** - Paper in Chinese, Arabic, etc. to test character handling

#### Zotero Collections
- Create test collection: "MCP Test Collection" - note the collection key

---

## Test Cases

## 1. PDF Metadata Extraction Module Tests

### 1.1 PDFProcessor.extractMetadata()

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| PDF-001 | Extract metadata from valid PDF with full metadata | PDF with title, author, keywords | PDFMetadata object with all fields populated | High |
| PDF-002 | Extract metadata from minimal PDF | PDF with only title | PDFMetadata with title only, other fields undefined | High |
| PDF-003 | Handle corrupted PDF metadata | PDF with malformed metadata | Empty PDFMetadata object (graceful degradation) | Medium |
| PDF-004 | Parse PDF date format | PDF with creation date "D:20230115120000+08'00'" | ISO format: "2023-01-15T12:00:00.000Z" | Medium |
| PDF-005 | Handle missing file | Non-existent file path | Return empty metadata (no crash) | High |
| PDF-006 | Extract keywords | PDF with Keywords field "machine learning, AI, neural networks" | Array: ["machine learning", "AI", "neural networks"] | Low |

**Test Method**: Direct function calls in Zotero's Developer Console
```javascript
// Zotero Developer Console
const ztoolkit = Zotero.ZoteroMCPExt.addon.ztoolkit;
const PDFProcessor = Components.utils.import("resource://zotero-mcp-ext/pdfProcessor.js");
const processor = new PDFProcessor(ztoolkit);
const metadata = await processor.extractMetadata("/path/to/test.pdf");
console.log(JSON.stringify(metadata, null, 2));
```

---

### 1.2 ZoteroMetadataRetriever Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| ZMR-001 | Retrieve metadata from PDF with clear DOI | Academic paper PDF with visible DOI | RetrievedMetadata with title, authors, DOI, journal, etc. | High |
| ZMR-002 | Retrieve metadata from PDF without DOI | Technical report without DOI | Partial metadata or null (graceful failure) | High |
| ZMR-003 | Retrieve from DOI directly | Valid DOI string "10.1234/example" | Full metadata from Crossref | Medium |
| ZMR-004 | Retrieve from ISBN | Valid ISBN "978-0-123456-78-9" | Book metadata | Medium |
| ZMR-005 | Handle web service timeout | PDF that takes >30s to process | Return null after timeout, no crash | High |
| ZMR-006 | Handle invalid DOI | Invalid DOI format | Return null, no crash | Medium |
| ZMR-007 | Handle offline mode | No internet connection | Return null gracefully | Low |

**Test Method**:
```javascript
// Zotero Developer Console
const retriever = new ZoteroMetadataRetriever(ztoolkit);
const metadata = await retriever.retrieveFromPDF("/path/to/paper.pdf");
console.log(JSON.stringify(metadata, null, 2));
retriever.terminate();
```

---

### 1.3 ItemCreator Tests

| Test ID | Test Case | Input | Expected Output | Priority |
|---------|-----------|-------|-----------------|----------|
| IC-001 | Create item with full metadata | PDF + complete RetrievedMetadata | New item with all fields populated | High |
| IC-002 | Create item with partial metadata | PDF + partial metadata | Item with some fields filled | High |
| IC-003 | Create item with no metadata | PDF only (no metadata) | Item with filename as title | High |
| IC-004 | Attach PDF to item | PDF path + item | Item with PDF attachment | High |
| IC-005 | Add item to collection | PDF + collectionKey | Item appears in specified collection | Medium |
| IC-006 | Handle invalid collection key | PDF + invalid collectionKey | Item created but not added to collection (logged error) | Low |
| IC-007 | Enrich existing item (no overwrite) | Item with title + new metadata | Only empty fields filled | High |
| IC-008 | Enrich existing item (overwrite) | Item with title + new metadata + overwrite=true | All fields updated | High |
| IC-009 | Merge tags without duplicates | Item with tags ["AI"] + metadata tags ["AI", "ML"] | Final tags: ["AI", "ML"] | Medium |
| IC-010 | Track metadata sources | Create item with web + PDF metadata | metadataSources shows which fields from which source | Medium |

**Test Method**:
```javascript
// Zotero Developer Console
const creator = new ItemCreator();
const result = await creator.createItemFromPDF(
  "/path/to/paper.pdf",
  "COLLECTIONKEY123",
  { title: "Test Paper", itemType: "journalArticle" },
  { keywords: ["test"] }
);
console.log(JSON.stringify(result, null, 2));
```

---

## 2. MCP Tool Integration Tests

### 2.1 Tool: upload_pdf_and_create_item

#### Test Scenarios

| Test ID | Scenario | MCP Request | Expected Response | Validation Steps | Priority |
|---------|----------|-------------|-------------------|------------------|----------|
| MCP-U01 | Upload academic paper with DOI | See below | Item created with full metadata | Check item in Zotero, verify DOI field | **Critical** |
| MCP-U02 | Upload PDF to specific collection | Include collectionKey | Item appears in collection | Verify item in collection view | High |
| MCP-U03 | Upload with web service disabled | useWebService=false | Item created with PDF properties only | Check metadataSources in response | Medium |
| MCP-U04 | Upload with PDF properties disabled | extractPDFProperties=false | Item created with web metadata only | Check metadataSources in response | Medium |
| MCP-U05 | Upload with both sources disabled | Both false | Item created with filename as title | Check item has minimal metadata | Medium |
| MCP-U06 | Upload non-existent file | Invalid path | Error response with clear message | Verify error handling | High |
| MCP-U07 | Upload large PDF (50+ MB) | Large file path | Item created (may be slow) | Monitor performance, verify no timeout | Medium |
| MCP-U08 | Override item type | itemType="book" | Item created as book type | Check item.itemType | Low |
| MCP-U09 | Upload PDF with non-ASCII characters | Path with Chinese/Arabic filename | Item created successfully | Verify filename handling | Medium |

**MCP-U01 Request Example** (via Claude Desktop or MCP client):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "upload_pdf_and_create_item",
    "arguments": {
      "pdfPath": "/Users/test/Downloads/sample_paper.pdf",
      "collectionKey": "ABC123XYZ",
      "useWebService": true,
      "extractPDFProperties": true
    }
  }
}
```

**Expected Response Structure**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{
        \"data\": {
          \"success\": true,
          \"item\": {
            \"key\": \"NEWITEM123\",
            \"id\": 12345,
            \"title\": \"Sample Paper Title\",
            \"creators\": \"John Doe, Jane Smith\",
            \"itemType\": \"journalArticle\",
            \"date\": \"2023\",
            \"DOI\": \"10.1234/example\"
          },
          \"attachment\": {
            \"key\": \"ATTACH456\",
            \"filename\": \"sample_paper.pdf\"
          },
          \"fieldsSet\": [\"title\", \"creators\", \"date\", \"DOI\", \"abstractNote\", \"publicationTitle\"],
          \"metadataSources\": {
            \"webService\": [\"title\", \"creators\", \"DOI\", \"abstractNote\"],
            \"pdfProperties\": [\"date\"],
            \"manual\": []
          }
        },
        \"metadata\": { ... }
      }"
    }]
  }
}
```

**Validation Checklist for MCP-U01**:
- [ ] Item appears in Zotero library
- [ ] Item is in correct collection
- [ ] PDF is attached to item
- [ ] Title matches paper title
- [ ] Authors are correctly parsed
- [ ] DOI field is populated
- [ ] Abstract is extracted (if available)
- [ ] Publication/journal name is correct
- [ ] metadataSources accurately reflects data origins
- [ ] Response time < 30 seconds

---

### 2.2 Tool: enrich_item_from_pdf

#### Test Scenarios

| Test ID | Scenario | MCP Request | Expected Response | Validation Steps | Priority |
|---------|----------|-------------|-------------------|------------------|----------|
| MCP-E01 | Enrich item with empty fields | See below | Empty fields filled, existing preserved | Compare before/after item state | **Critical** |
| MCP-E02 | Enrich with overwrite enabled | overwriteExisting=true | All fields updated | Verify fields changed | High |
| MCP-E03 | Enrich specific fields only | fieldsToUpdate=["abstractNote", "DOI"] | Only specified fields updated | Check other fields unchanged | Medium |
| MCP-E04 | Enrich item with no PDF | Item without PDF attachment | Error: "No PDF attachment found" | Verify error message | High |
| MCP-E05 | Enrich with specific attachment | Include attachmentKey | Uses specified PDF, not first | Verify correct PDF used | Medium |
| MCP-E06 | Enrich item with multiple PDFs | Item with 3 PDFs | Uses first PDF by default | Check which PDF was processed | Low |
| MCP-E07 | Add tags from PDF metadata | PDF with keywords | Tags merged with existing | Verify tag list | Medium |
| MCP-E08 | Enrich invalid item key | Non-existent itemKey | Error: "Item not found" | Verify error handling | High |

**MCP-E01 Request Example**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "enrich_item_from_pdf",
    "arguments": {
      "itemKey": "EXISTING123",
      "overwriteExisting": false,
      "useWebService": true,
      "extractPDFProperties": true
    }
  }
}
```

**Expected Response Structure**:
```json
{
  "data": {
    "success": true,
    "item": {
      "key": "EXISTING123",
      "title": "Enriched Title",
      "itemType": "journalArticle"
    },
    "enrichmentSummary": {
      "fieldsUpdated": ["abstractNote", "DOI", "publicationTitle"],
      "fieldsSkipped": ["title", "creators"],
      "tagsAdded": ["machine-learning", "neural-networks"],
      "metadataSources": {
        "webService": ["abstractNote", "DOI"],
        "pdfProperties": ["publicationTitle"],
        "manual": []
      }
    }
  },
  "metadata": { ... }
}
```

**Validation Checklist for MCP-E01**:
- [ ] Item key matches request
- [ ] fieldsUpdated list is accurate
- [ ] fieldsSkipped contains existing non-empty fields
- [ ] New tags added without removing existing
- [ ] No data loss on existing fields
- [ ] metadataSources accurately shows origins

---

## 3. End-to-End Workflow Tests

### 3.1 AI Assistant Workflows

Test with actual AI clients (Claude Desktop, etc.)

#### Workflow 1: Research Paper Collection
**User Prompt**: "I have a PDF of a research paper at /Users/test/paper.pdf. Add it to my Zotero library in the 'Machine Learning' collection."

**Expected AI Actions**:
1. AI calls `get_collections` to find "Machine Learning" collection key
2. AI calls `upload_pdf_and_create_item` with pdfPath and collectionKey
3. AI reports success with item details to user

**Validation**:
- [ ] AI correctly identifies collection
- [ ] Item created with metadata
- [ ] AI communicates results clearly to user

---

#### Workflow 2: Enrich Incomplete Entry
**User Prompt**: "This item (key: ABC123) is missing metadata. Can you fill it in from the attached PDF?"

**Expected AI Actions**:
1. AI calls `get_item_details` to check current metadata
2. AI calls `enrich_item_from_pdf` with itemKey
3. AI reports which fields were updated

**Validation**:
- [ ] AI assesses current state
- [ ] Enrichment preserves existing data
- [ ] AI summarizes changes

---

#### Workflow 3: Batch Upload
**User Prompt**: "Add all PDFs from /Users/test/papers/ to my library"

**Expected AI Actions**:
1. Lists files in directory
2. Iterates through PDFs calling `upload_pdf_and_create_item`
3. Reports summary of successes/failures

**Validation**:
- [ ] All PDFs processed
- [ ] Errors handled gracefully
- [ ] Summary is accurate

---

## 4. Error Handling & Edge Cases

### 4.1 Error Scenarios

| Test ID | Error Scenario | Expected Behavior | How to Test |
|---------|----------------|-------------------|-------------|
| ERR-001 | PDF file not found | Return error: "File not found" | Use non-existent path |
| ERR-002 | PDF file not readable (permissions) | Return error with permission message | Use chmod 000 on test file |
| ERR-003 | Corrupted PDF | Gracefully fail, return partial/empty metadata | Use damaged PDF file |
| ERR-004 | Web service timeout | Fall back to PDF properties, log timeout | Test with slow network or large file |
| ERR-005 | Web service unavailable | Fall back to PDF properties | Disconnect internet during test |
| ERR-006 | Invalid collection key | Item created but not in collection, error logged | Use fake collection key |
| ERR-007 | Item already exists with same title | Creates new item anyway (Zotero allows duplicates) | Test with duplicate |
| ERR-008 | PDF with no metadata at all | Item created with filename as title | Test with blank PDF |
| ERR-009 | Non-PDF file provided | Error: "Invalid file type" or process as generic | Try .txt or .docx file |
| ERR-010 | Concurrent requests | Both complete successfully | Call tool twice simultaneously |

---

### 4.2 Data Validation Tests

| Test ID | Validation Test | Input | Expected Behavior |
|---------|----------------|-------|-------------------|
| VAL-001 | Special characters in title | PDF with title containing quotes, colons | Title saved correctly with escaping |
| VAL-002 | Very long author list | PDF with 50+ authors | All authors saved or truncated gracefully |
| VAL-003 | Non-Latin characters | Chinese/Arabic/Cyrillic text in metadata | UTF-8 encoding preserved |
| VAL-004 | HTML in abstract | Abstract with HTML tags | Tags stripped or escaped |
| VAL-005 | Missing required fields | Metadata without title | Uses fallback (filename) |
| VAL-006 | Invalid DOI format | Malformed DOI in PDF | Either corrected or skipped |
| VAL-007 | Future publication date | Date in future | Accepted (might be forthcoming) |
| VAL-008 | Very old publication date | Date before 1900 | Accepted |

---

## 5. Performance Tests

### 5.1 Performance Benchmarks

| Test ID | Scenario | Target | Acceptance Criteria |
|---------|----------|--------|---------------------|
| PERF-001 | Small PDF (< 5 MB) upload | < 10 seconds | Metadata extraction + item creation |
| PERF-002 | Medium PDF (5-20 MB) upload | < 20 seconds | Should not timeout |
| PERF-003 | Large PDF (20-50 MB) upload | < 30 seconds | Should complete before timeout |
| PERF-004 | Enrich existing item | < 15 seconds | Faster than upload (no attachment) |
| PERF-005 | Batch upload 10 PDFs | < 2 minutes | Sequential processing |
| PERF-006 | PDF metadata extraction only | < 2 seconds | Just PDF properties, no web service |

**Test Method**: Use console.time() / console.timeEnd() to measure
```javascript
console.time('upload_pdf');
// ... call tool ...
console.timeEnd('upload_pdf');
```

---

## 6. Security & Safety Tests

| Test ID | Security Test | Risk | Test Method |
|---------|---------------|------|-------------|
| SEC-001 | Path traversal | Malicious paths like "../../etc/passwd" | Verify path validation |
| SEC-002 | Code injection in metadata | PDF with JavaScript in metadata | Ensure metadata sanitized |
| SEC-003 | Extremely large file | 500+ MB PDF | Ensure file size limits enforced |
| SEC-004 | Symlink exploitation | PDF path is symlink to sensitive file | Verify symlink handling |

---

## 7. Regression Tests

After each code change, verify:
- [ ] Existing MCP tools still work (`search_library`, `get_content`, etc.)
- [ ] PDF text extraction not broken
- [ ] Annotation extraction still functions
- [ ] Plugin loads without errors
- [ ] MCP server starts correctly

---

## 8. Manual Test Checklist

### Pre-Test Setup
- [ ] Install plugin build in Zotero 7
- [ ] Enable MCP server in preferences
- [ ] Configure MCP client (Claude Desktop)
- [ ] Prepare test PDFs in known location
- [ ] Create test collection in Zotero
- [ ] Note collection key for tests

### Test Execution
- [ ] Test MCP-U01: Upload academic paper
- [ ] Test MCP-U02: Upload to collection
- [ ] Test MCP-E01: Enrich empty fields
- [ ] Test MCP-E02: Enrich with overwrite
- [ ] Test ERR-001: File not found error
- [ ] Test ERR-004: Web service timeout
- [ ] Test PERF-001: Performance benchmark
- [ ] Test AI Workflow 1: Full user scenario

### Post-Test Verification
- [ ] Check Zotero library for test items
- [ ] Verify no duplicate items created
- [ ] Check plugin logs for errors
- [ ] Confirm no data corruption
- [ ] Remove test items from library

---

## 9. Test Results Template

### Test Execution Record

**Test Date**: ___________
**Tester**: ___________
**Plugin Version**: ___________
**Zotero Version**: ___________

| Test ID | Status | Notes | Issues Found |
|---------|--------|-------|--------------|
| MCP-U01 | ⬜ Pass ⬜ Fail | | |
| MCP-U02 | ⬜ Pass ⬜ Fail | | |
| MCP-E01 | ⬜ Pass ⬜ Fail | | |
| ... | | | |

### Known Issues
1. Issue description
2. Severity: Critical / High / Medium / Low
3. Workaround (if any)

### Test Summary
- Total Tests Run: ___
- Passed: ___
- Failed: ___
- Blocked: ___
- Pass Rate: ___%

---

## 10. Automated Test Implementation (Future)

### Recommended Test Framework
- **Unit Tests**: Mocha + Chai for JavaScript
- **Integration Tests**: Custom MCP client for automated tool calls
- **Fixtures**: Sample PDFs with known metadata

### Sample Unit Test Structure
```javascript
describe('PDFMetadataExtractor', () => {
  it('should extract title from PDF', async () => {
    const extractor = new PDFMetadataExtractor(ztoolkit);
    const metadata = await extractor.extractMetadata('./test/fixtures/sample.pdf');
    expect(metadata.title).to.equal('Expected Title');
  });

  it('should handle missing file gracefully', async () => {
    const extractor = new PDFMetadataExtractor(ztoolkit);
    const metadata = await extractor.extractMetadata('./nonexistent.pdf');
    expect(metadata).to.be.empty;
  });
});
```

---

## Appendix A: Test Data Preparation

### Creating Test PDFs

1. **Academic Paper with DOI**: Download from publisher or arXiv
2. **PDF with Custom Metadata**: Use Adobe Acrobat or PDFtk to add metadata
   ```bash
   pdftk input.pdf update_info metadata.txt output output.pdf
   ```
3. **Minimal PDF**: Create blank PDF with minimal metadata
4. **Corrupted PDF**: Truncate valid PDF file to create corruption

### Metadata Template (metadata.txt for PDFtk)
```
InfoKey: Title
InfoValue: Test Document Title
InfoKey: Author
InfoValue: John Doe
InfoKey: Subject
InfoValue: Test subject for metadata extraction
InfoKey: Keywords
InfoValue: testing, metadata, extraction
InfoKey: Creator
InfoValue: PDFtk
InfoKey: Producer
InfoValue: Test Producer
```

---

## Appendix B: Troubleshooting Guide

### Common Issues

**Issue**: Web service always times out
**Solution**: Check internet connection, increase timeout in zoteroMetadataRetriever.ts

**Issue**: PDF not attaching to item
**Solution**: Check file permissions, verify path is absolute

**Issue**: Metadata not extracted
**Solution**: Check PDF has metadata (use `pdfinfo` command), verify PDF is not encrypted

**Issue**: MCP tool not found
**Solution**: Rebuild plugin, restart Zotero, verify plugin loaded

---

## Test Sign-Off

### Approval
- [ ] All critical tests passed
- [ ] Known issues documented
- [ ] Performance benchmarks met
- [ ] Security tests passed
- [ ] Ready for production release

**QA Lead**: ___________
**Date**: ___________
**Signature**: ___________
