# Quick Test Guide - PDF Metadata MCP Tools

## 🚀 Quick Start Testing (5 minutes)

### Prerequisites
- ✅ Zotero 7 running
- ✅ Plugin installed (`zotero-mcp-ext.xpi`)
- ✅ MCP server enabled and running
- ✅ Claude Desktop (or another MCP client) connected
- ✅ A sample academic PDF ready

---

## Test 1: Upload a PDF (2 minutes)

### Step 1: Prepare a Test PDF
Download any academic paper PDF, for example:
- From arXiv: https://arxiv.org/pdf/2301.00001.pdf
- Or use any PDF you have locally

### Step 2: Get Collection Key (Optional)
In Zotero:
1. Right-click any collection
2. Select "Copy Zotero Link"
3. Extract the key from URL: `zotero://select/library/collections/{KEY}`

### Step 3: Test via Claude Desktop

**Prompt to Claude**:
```
I have a PDF at /Users/yourname/Downloads/paper.pdf
Please upload it to my Zotero library and extract the metadata.
```

**Expected**: Claude will call `upload_pdf_and_create_item` and create the item.

**Verify**:
- [ ] New item appears in Zotero library
- [ ] PDF is attached to the item
- [ ] Metadata fields are populated (title, authors, etc.)
- [ ] Claude reports success with item details

---

## Test 2: Enrich an Existing Item (2 minutes)

### Step 1: Create a Test Item
In Zotero:
1. Create a new item (any type)
2. Add a PDF attachment (drag & drop a PDF)
3. Leave some fields empty (e.g., no abstract, no DOI)
4. Note the item key (right-click → Copy Zotero Link)

### Step 2: Test Enrichment via Claude

**Prompt to Claude**:
```
I have a Zotero item with key ABC123XYZ that's missing metadata.
Can you extract metadata from its PDF attachment and fill in the missing fields?
```

**Expected**: Claude will call `enrich_item_from_pdf` and update the item.

**Verify**:
- [ ] Item metadata is updated
- [ ] Existing data is NOT overwritten
- [ ] Empty fields are now filled
- [ ] Claude reports which fields were updated

---

## Test 3: Error Handling (1 minute)

### Test Invalid Path

**Prompt to Claude**:
```
Upload this PDF to Zotero: /nonexistent/file.pdf
```

**Expected**: Clear error message about file not found.

**Verify**:
- [ ] Error message is returned
- [ ] No item is created
- [ ] No crash or hang

---

## Direct MCP Testing (Advanced)

If you want to test the MCP tools directly without an AI client:

### Using curl to test the MCP endpoint

```bash
# Test upload_pdf_and_create_item
curl -X POST http://localhost:23120/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "upload_pdf_and_create_item",
      "arguments": {
        "pdfPath": "/path/to/your/paper.pdf",
        "useWebService": true,
        "extractPDFProperties": true
      }
    }
  }'
```

### Expected Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "{ \"data\": { \"success\": true, \"item\": {...}, ... } }"
    }]
  }
}
```

---

## Using Zotero Developer Console (Most Direct)

### Open Zotero Developer Console
1. In Zotero: Tools → Developer → Run JavaScript
2. Or press `Ctrl+Shift+J` (Windows/Linux) or `Cmd+Shift+J` (Mac)

### Test PDFMetadataExtractor
```javascript
// Get the ztoolkit
const ztoolkit = Zotero.ZoteroMCPExt.addon.ztoolkit;

// Import the extractor
const { PDFMetadataExtractor } = ChromeUtils.import("chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js");

// Extract metadata
const extractor = new PDFMetadataExtractor(ztoolkit);
const metadata = await extractor.extractMetadata("/Users/yourname/Downloads/paper.pdf");
console.log(JSON.stringify(metadata, null, 2));
```

### Test ZoteroMetadataRetriever
```javascript
const { ZoteroMetadataRetriever } = ChromeUtils.import("chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js");

const retriever = new ZoteroMetadataRetriever(ztoolkit);
const webMeta = await retriever.retrieveFromPDF("/Users/yourname/Downloads/paper.pdf");
console.log("Web metadata:", JSON.stringify(webMeta, null, 2));
retriever.terminate();
```

### Test ItemCreator
```javascript
const { ItemCreator } = ChromeUtils.import("chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js");

const creator = new ItemCreator();
const result = await creator.createItemFromPDF(
  "/Users/yourname/Downloads/paper.pdf",
  null, // no collection
  { title: "Test Paper", itemType: "journalArticle" }
);
console.log("Created item:", JSON.stringify(result, null, 2));
```

---

## Verification Checklist

After testing, verify:

### ✅ Basic Functionality
- [ ] PDF uploads create new items
- [ ] Metadata is extracted from PDFs
- [ ] Items appear in Zotero library
- [ ] PDFs are attached to items

### ✅ Metadata Quality
- [ ] Titles are extracted correctly
- [ ] Authors are parsed properly
- [ ] DOI fields are populated (when available)
- [ ] Abstracts are extracted (when available)

### ✅ Error Handling
- [ ] Invalid paths return errors (no crash)
- [ ] Missing PDFs handled gracefully
- [ ] Timeouts don't cause hangs

### ✅ Integration
- [ ] MCP client can call tools
- [ ] Responses are properly formatted
- [ ] AI can interpret results

---

## Common Issues & Solutions

### Issue: "Cannot find module"
**Solution**: Rebuild plugin with `npm run build`, reinstall XPI

### Issue: "MCP server not responding"
**Solution**:
1. Check plugin preferences → MCP Server is enabled
2. Restart Zotero
3. Check port 23120 is not in use

### Issue: "Metadata extraction returns empty"
**Solution**:
1. Verify PDF has metadata (use `pdfinfo` command)
2. Check internet connection (for web service)
3. Try with `extractPDFProperties: true` only

### Issue: "Web service timeout"
**Solution**:
1. Try smaller PDF files first
2. Check internet connection
3. PDF might not be recognized (try different PDF)

### Issue: "Item created but no metadata"
**Solution**:
1. Check PDF is not encrypted/protected
2. Verify PDF has text (not just scanned image)
3. Try with a different, known-good PDF (e.g., from arXiv)

---

## Success Criteria

✅ **Test is successful if:**
1. At least one PDF successfully uploads and creates item
2. Metadata fields are populated (title minimum)
3. PDF is attached to the item
4. Enrichment updates existing items without data loss
5. Errors are handled gracefully (no crashes)

---

## Next Steps After Testing

If tests pass:
- ✅ Start using with real papers
- ✅ Test with your specific PDF collection
- ✅ Report any issues found

If tests fail:
- 📝 Check Zotero debug logs (Help → Debug Output Logging)
- 📝 Check plugin console logs
- 📝 Note specific error messages
- 📝 Report issues with sample PDF if possible

---

## Quick Reference: Tool Parameters

### upload_pdf_and_create_item
```json
{
  "pdfPath": "/absolute/path/to/file.pdf",  // Required
  "collectionKey": "ABC123",                 // Optional
  "itemType": "journalArticle",              // Optional
  "useWebService": true,                     // Optional, default: true
  "extractPDFProperties": true               // Optional, default: true
}
```

### enrich_item_from_pdf
```json
{
  "itemKey": "ABC123XYZ",                    // Required
  "attachmentKey": "DEF456",                 // Optional
  "overwriteExisting": false,                // Optional, default: false
  "useWebService": true,                     // Optional, default: true
  "extractPDFProperties": true,              // Optional, default: true
  "fieldsToUpdate": ["abstractNote", "DOI"]  // Optional
}
```

---

## Support

For issues or questions:
- Check logs in Zotero: Help → Debug Output Logging
- Review full test plan: `TEST_PLAN_PDF_METADATA.md`
- Check plugin console in Developer Tools
