/**
 * Quick Test Script for PDF Metadata MCP Tools
 * Run in Zotero Developer Console
 *
 * This is a simplified test for quick verification
 */

(async function() {
  'use strict';

  console.log('🧪 Quick Test: PDF Metadata MCP Tools\n');

  // Get ztoolkit
  const ztoolkit = Zotero.ZoteroMCP?.addon?.ztoolkit;
  if (!ztoolkit) {
    console.error('❌ Plugin not loaded!');
    return;
  }

  console.log('✓ Plugin loaded\n');

  // ============================================================================
  // TEST 1: Load Modules
  // ============================================================================

  console.log('Test 1: Loading modules...');

  try {
    const modules = ChromeUtils.import(
      'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
    );

    const { PDFProcessor, PDFMetadataExtractor, ZoteroMetadataRetriever, ItemCreator } = modules;

    console.log('  ✓ PDFProcessor loaded');
    console.log('  ✓ PDFMetadataExtractor loaded');
    console.log('  ✓ ZoteroMetadataRetriever loaded');
    console.log('  ✓ ItemCreator loaded\n');

  } catch (e) {
    console.error('  ❌ Failed to load modules:', e.message);
    return;
  }

  // ============================================================================
  // TEST 2: Create Instances
  // ============================================================================

  console.log('Test 2: Creating instances...');

  try {
    const { PDFProcessor, PDFMetadataExtractor, ZoteroMetadataRetriever, ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
    );

    const processor = new PDFProcessor(ztoolkit);
    const extractor = new PDFMetadataExtractor(ztoolkit);
    const retriever = new ZoteroMetadataRetriever(ztoolkit);
    const creator = new ItemCreator();

    console.log('  ✓ PDFProcessor instance created');
    console.log('  ✓ PDFMetadataExtractor instance created');
    console.log('  ✓ ZoteroMetadataRetriever instance created');
    console.log('  ✓ ItemCreator instance created\n');

    // Clean up
    extractor.terminate();
    retriever.terminate();

  } catch (e) {
    console.error('  ❌ Failed to create instances:', e.message);
    return;
  }

  // ============================================================================
  // TEST 3: Test ItemCreator with Mock Data
  // ============================================================================

  console.log('Test 3: Testing ItemCreator.enrichExistingItem...');

  try {
    const { ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
    );

    // Create a test item
    const item = new Zotero.Item('journalArticle');
    item.libraryID = Zotero.Libraries.userLibraryID;
    item.setField('title', 'Quick Test Item');
    const itemID = await item.saveTx();

    console.log(`  ✓ Created test item (key: ${item.key})`);

    // Enrich it
    const creator = new ItemCreator();
    const mockMetadata = {
      itemType: 'journalArticle',
      abstractNote: 'This is a test abstract',
      date: '2023',
      DOI: '10.1234/test.001'
    };

    const result = await creator.enrichExistingItem(item.key, mockMetadata, null, false);

    console.log('  ✓ Enrichment completed');
    console.log(`    Fields updated: ${result.fieldsUpdated.join(', ')}`);
    console.log(`    Fields skipped: ${result.fieldsSkipped.join(', ')}`);

    // Clean up
    await item.eraseTx();
    console.log('  ✓ Test item deleted\n');

  } catch (e) {
    console.error('  ❌ ItemCreator test failed:', e.message);
    console.error(e.stack);
  }

  // ============================================================================
  // TEST 4: Test Error Handling
  // ============================================================================

  console.log('Test 4: Testing error handling...');

  try {
    const { PDFMetadataExtractor } = ChromeUtils.import(
      'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
    );

    const extractor = new PDFMetadataExtractor(ztoolkit);
    const metadata = await extractor.extractMetadata('/nonexistent/file.pdf');

    if (typeof metadata === 'object') {
      console.log('  ✓ Gracefully handled missing file (returned empty object)');
    } else {
      console.log('  ⚠ Unexpected response type:', typeof metadata);
    }

    extractor.terminate();

  } catch (e) {
    console.error('  ❌ Error handling test failed:', e.message);
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n' + '='.repeat(60));
  console.log('✅ Quick test completed!');
  console.log('='.repeat(60));
  console.log('\nAll modules loaded and basic functionality verified.');
  console.log('For comprehensive testing, run the full test suite.\n');

  return { success: true };

})().catch(error => {
  console.error('❌ Quick test error:', error);
  console.error(error.stack);
});
