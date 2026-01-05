# Automated Test Scripts for Zotero Console

These test scripts can be run directly in the Zotero Developer Console to verify the PDF metadata extraction functionality.

## Test Files

### 1. `zotero-console-tests.js` - Full Test Suite
Comprehensive automated test suite with 15+ test cases.

**Features:**
- ✅ Colored console output
- ✅ Test runner framework with assertions
- ✅ Detailed pass/fail reporting
- ✅ Tests for all modules (PDFProcessor, PDFMetadataExtractor, ZoteroMetadataRetriever, ItemCreator)
- ✅ Integration tests
- ✅ Error handling tests

**Test Coverage:**
- Module loading and imports
- Instance creation
- Error handling (missing files, invalid DOIs)
- Item enrichment (with/without overwrite)
- Metadata source tracking
- Field merging logic

### 2. `quick-test.js` - Quick Verification
Simplified test script for rapid verification (30 seconds).

**Tests:**
- Module loading
- Instance creation
- Basic ItemCreator functionality
- Error handling

---

## How to Run Tests

### Method 1: Full Test Suite (Recommended)

1. **Open Zotero 7**

2. **Open Developer Console**
   - Windows/Linux: `Tools → Developer → Run JavaScript`
   - Mac: `Tools → Developer → Run JavaScript`
   - Or press: `Ctrl/Cmd + Shift + J`

3. **Load Test Script**
   ```javascript
   // Copy entire contents of zotero-console-tests.js
   // Paste into console
   // Press "Run" or Ctrl/Cmd + Enter
   ```

4. **View Results**
   - Tests will run automatically
   - Results appear in console with color coding:
     - ✓ Green = Passed
     - ✗ Red = Failed
     - ⚠ Yellow = Skipped

### Method 2: Quick Test

```javascript
// Copy entire contents of quick-test.js
// Paste and run in Zotero console
```

---

## Sample Output

### Full Test Suite
```
================================================================================
🧪 ZOTERO MCP PDF METADATA TESTS
================================================================================

▶ Running: PDFProcessor: Module loads correctly
  ✓ PASSED: PDFProcessor: Module loads correctly

▶ Running: PDFProcessor: Creates instance
  ✓ PASSED: PDFProcessor: Creates instance

▶ Running: PDFMetadataExtractor: Handles missing file gracefully
  ✓ PASSED: PDFMetadataExtractor: Handles missing file gracefully

...

================================================================================
📊 TEST SUMMARY
================================================================================
Total:   15
Passed:  13
Failed:  0
Skipped: 2
Duration: 2.34s
Pass Rate: 100.0%
================================================================================

🎉 All tests passed!
```

### Quick Test
```
🧪 Quick Test: PDF Metadata MCP Tools

✓ Plugin loaded

Test 1: Loading modules...
  ✓ PDFProcessor loaded
  ✓ PDFMetadataExtractor loaded
  ✓ ZoteroMetadataRetriever loaded
  ✓ ItemCreator loaded

Test 2: Creating instances...
  ✓ PDFProcessor instance created
  ✓ PDFMetadataExtractor instance created
  ✓ ZoteroMetadataRetriever instance created
  ✓ ItemCreator instance created

Test 3: Testing ItemCreator.enrichExistingItem...
  ✓ Created test item (key: ABC123XYZ)
  ✓ Enrichment completed
    Fields updated: abstractNote, date, DOI
    Fields skipped: title
  ✓ Test item deleted

============================================================
✅ Quick test completed!
============================================================
```

---

## Test Configuration

### Setting Test PDF Path

For tests that require an actual PDF file, edit the test file:

```javascript
// In zotero-console-tests.js, find:
getTestPDFPath() {
  // REPLACE THIS with path to a real PDF on your system
  const testPath = '/path/to/your/test-paper.pdf';
  return testPath;
}
```

**Recommended Test PDFs:**
- Academic paper from arXiv (has DOI)
- Any PDF with embedded metadata
- Minimal/blank PDF (for error testing)

---

## Individual Module Testing

You can also test modules individually in the console:

### Test PDFMetadataExtractor
```javascript
const ztoolkit = Zotero.ZoteroMCP.addon.ztoolkit;
const { PDFMetadataExtractor } = ChromeUtils.import(
  'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
);

const extractor = new PDFMetadataExtractor(ztoolkit);
const metadata = await extractor.extractMetadata('/path/to/paper.pdf');
console.log(JSON.stringify(metadata, null, 2));
extractor.terminate();
```

### Test ZoteroMetadataRetriever
```javascript
const ztoolkit = Zotero.ZoteroMCP.addon.ztoolkit;
const { ZoteroMetadataRetriever } = ChromeUtils.import(
  'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
);

const retriever = new ZoteroMetadataRetriever(ztoolkit);

// Test DOI lookup
const metadata = await retriever.retrieveFromDOI('10.1145/3290605.3300361');
console.log(JSON.stringify(metadata, null, 2));

retriever.terminate();
```

### Test ItemCreator
```javascript
const { ItemCreator } = ChromeUtils.import(
  'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
);

// Create test item
const item = new Zotero.Item('journalArticle');
item.libraryID = Zotero.Libraries.userLibraryID;
item.setField('title', 'Test');
await item.saveTx();

// Enrich it
const creator = new ItemCreator();
const result = await creator.enrichExistingItem(
  item.key,
  { abstractNote: 'Test abstract', DOI: '10.1234/test' },
  null,
  false
);

console.log('Updated:', result.fieldsUpdated);
console.log('Skipped:', result.fieldsSkipped);

// Clean up
await item.eraseTx();
```

---

## Troubleshooting

### Issue: "Cannot find module"
**Solution:**
- Ensure plugin is installed and enabled
- Restart Zotero
- Rebuild plugin with `npm run build`

### Issue: "ztoolkit is undefined"
**Solution:**
```javascript
// Check plugin status
Zotero.ZoteroMCP  // Should return object, not undefined
```

### Issue: Tests fail with "SKIP: No test PDF"
**Solution:**
- This is expected if you haven't set a test PDF path
- Either set the path in `getTestPDFPath()` or ignore these tests
- Tests will show as "Skipped" in summary

### Issue: Import fails
**Solution:**
```javascript
// Try alternative import method
const { PDFProcessor } = Cu.import('chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js');
```

---

## Continuous Integration

These tests can be integrated into CI/CD pipelines using Zotero's headless mode:

```bash
# Example: Run tests in headless Zotero
zotero --headless --run-script tests/zotero-console-tests.js
```

---

## Test Coverage Summary

| Module | Tests | Coverage |
|--------|-------|----------|
| PDFProcessor | 3 | Module loading, instance creation, metadata extraction |
| PDFMetadataExtractor | 3 | Module loading, instance creation, error handling |
| ZoteroMetadataRetriever | 3 | Module loading, instance creation, invalid DOI handling |
| ItemCreator | 5 | Module loading, enrichment, overwrite mode, error handling |
| Integration | 2 | Metadata merging, source tracking |

**Total Test Cases**: 16
**Estimated Run Time**: 2-5 seconds (without PDF tests)

---

## Adding New Tests

To add a new test to the suite:

```javascript
TestRunner.test('Your test name', async () => {
  // Your test code here
  const result = await someFunction();

  // Use assertions
  assert.exists(result, 'Result should exist');
  assert.equals(result.value, 'expected', 'Value should match');
});
```

Available assertions:
- `assert.isTrue(condition, message)`
- `assert.isFalse(condition, message)`
- `assert.equals(actual, expected, message)`
- `assert.notEquals(actual, expected, message)`
- `assert.exists(value, message)`
- `assert.isNull(value, message)`
- `assert.isArray(value, message)`
- `assert.isObject(value, message)`
- `assert.hasProperty(obj, prop, message)`
- `assert.arrayLength(arr, length, message)`

---

## Performance Testing

To measure performance:

```javascript
console.time('operation');
await yourOperation();
console.timeEnd('operation');
```

---

## Next Steps

After running tests:
1. ✅ Verify all critical tests pass
2. ✅ Review any skipped tests
3. ✅ Test with real PDFs for comprehensive validation
4. ✅ Run manual tests from `QUICK_TEST_GUIDE.md`
5. ✅ Test MCP tools via Claude Desktop or other clients
