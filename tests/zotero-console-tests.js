/**
 * Automated Test Suite for PDF Metadata Extraction MCP Tools
 * Run in Zotero Developer Console: Tools → Developer → Run JavaScript
 *
 * Usage:
 * 1. Copy this entire file
 * 2. Paste into Zotero Developer Console
 * 3. Press "Run" or Ctrl/Cmd + Enter
 * 4. View results in console output
 */

(async function() {
  'use strict';

  // ============================================================================
  // TEST FRAMEWORK
  // ============================================================================

  const TestRunner = {
    tests: [],
    results: { passed: 0, failed: 0, skipped: 0, total: 0 },
    startTime: null,

    // ANSI color codes for console output
    colors: {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      green: '\x1b[32m',
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m',
    },

    log(message, color = 'reset') {
      const colorCode = this.colors[color] || this.colors.reset;
      Zotero.debug(`${colorCode}${message}${this.colors.reset}`);
      return message;
    },

    async run() {
      this.startTime = Date.now();
      this.log('\n' + '='.repeat(80), 'cyan');
      this.log('🧪 ZOTERO MCP PDF METADATA TESTS', 'bright');
      this.log('='.repeat(80) + '\n', 'cyan');

      for (const test of this.tests) {
        await this.runTest(test);
      }

      this.printSummary();
    },

    async runTest(test) {
      this.results.total++;
      this.log(`\n▶ Running: ${test.name}`, 'blue');

      try {
        await test.fn();
        this.results.passed++;
        this.log(`  ✓ PASSED: ${test.name}`, 'green');
      } catch (error) {
        this.results.failed++;
        this.log(`  ✗ FAILED: ${test.name}`, 'red');
        this.log(`    Error: ${error.message}`, 'red');
        if (error.stack) {
          this.log(`    ${error.stack.split('\n').slice(0, 3).join('\n    ')}`, 'red');
        }
      }
    },

    printSummary() {
      const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);

      this.log('\n' + '='.repeat(80), 'cyan');
      this.log('📊 TEST SUMMARY', 'bright');
      this.log('='.repeat(80), 'cyan');
      this.log(`Total:   ${this.results.total}`, 'bright');
      this.log(`Passed:  ${this.results.passed}`, 'green');
      this.log(`Failed:  ${this.results.failed}`, this.results.failed > 0 ? 'red' : 'reset');
      this.log(`Skipped: ${this.results.skipped}`, 'yellow');
      this.log(`Duration: ${duration}s`, 'cyan');

      const passRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
      this.log(`Pass Rate: ${passRate}%`, passRate >= 80 ? 'green' : 'red');
      this.log('='.repeat(80) + '\n', 'cyan');

      if (this.results.failed === 0) {
        this.log('🎉 All tests passed!', 'green');
      } else {
        this.log(`⚠️  ${this.results.failed} test(s) failed`, 'red');
      }
    },

    test(name, fn) {
      this.tests.push({ name, fn });
    }
  };

  // Assertion helpers
  const assert = {
    isTrue(condition, message = 'Expected true') {
      if (!condition) throw new Error(message);
    },

    isFalse(condition, message = 'Expected false') {
      if (condition) throw new Error(message);
    },

    equals(actual, expected, message) {
      if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
      }
    },

    notEquals(actual, expected, message) {
      if (actual === expected) {
        throw new Error(message || `Expected not to equal ${expected}`);
      }
    },

    exists(value, message = 'Expected value to exist') {
      if (value === null || value === undefined) {
        throw new Error(message);
      }
    },

    isNull(value, message = 'Expected null') {
      if (value !== null) {
        throw new Error(message);
      }
    },

    isArray(value, message = 'Expected array') {
      if (!Array.isArray(value)) {
        throw new Error(message);
      }
    },

    isObject(value, message = 'Expected object') {
      if (typeof value !== 'object' || value === null) {
        throw new Error(message);
      }
    },

    hasProperty(obj, prop, message) {
      if (!obj.hasOwnProperty(prop)) {
        throw new Error(message || `Expected object to have property '${prop}'`);
      }
    },

    arrayLength(arr, length, message) {
      if (!Array.isArray(arr) || arr.length !== length) {
        throw new Error(message || `Expected array length ${length}, got ${arr?.length}`);
      }
    },

    throwsAsync(fn, message = 'Expected function to throw') {
      return fn().then(
        () => { throw new Error(message); },
        () => { /* Expected to throw */ }
      );
    }
  };

  // ============================================================================
  // TEST UTILITIES
  // ============================================================================

  const TestUtils = {
    // Get ztoolkit
    getZtoolkit() {
      return Zotero.ZoteroMCPExt?.addon?.ztoolkit;
    },

    // Create a test PDF file path (you'll need to replace with actual path)
    getTestPDFPath() {
      // IMPORTANT: Replace this with an actual PDF path on your system
      const testPath = '/tmp/test-paper.pdf';
      TestRunner.log(`  ℹ Using test PDF: ${testPath}`, 'yellow');
      return testPath;
    },

    // Create a test item
    async createTestItem(itemType = 'journalArticle') {
      const item = new Zotero.Item(itemType);
      item.libraryID = Zotero.Libraries.userLibraryID;
      item.setField('title', 'Test Item for MCP Tests');
      const itemID = await item.saveTx();
      return item;
    },

    // Clean up test item
    async deleteTestItem(itemKey) {
      try {
        const item = Zotero.Items.getByLibraryAndKey(
          Zotero.Libraries.userLibraryID,
          itemKey
        );
        if (item) {
          await item.eraseTx();
        }
      } catch (e) {
        TestRunner.log(`  ⚠ Could not delete test item: ${e.message}`, 'yellow');
      }
    },

    // Create mock PDF metadata
    getMockPDFMetadata() {
      return {
        title: 'Test Paper Title',
        author: 'John Doe',
        subject: 'This is a test abstract',
        keywords: ['machine-learning', 'testing'],
        creator: 'Test Creator',
        producer: 'Test Producer',
        creationDate: '2023-01-15T12:00:00.000Z',
        pageCount: 10
      };
    },

    // Create mock retrieved metadata
    getMockRetrievedMetadata() {
      return {
        itemType: 'journalArticle',
        title: 'Machine Learning for Testing',
        creators: [
          { firstName: 'John', lastName: 'Doe', creatorType: 'author' },
          { firstName: 'Jane', lastName: 'Smith', creatorType: 'author' }
        ],
        date: '2023',
        publicationTitle: 'Journal of Test Automation',
        volume: '42',
        issue: '3',
        pages: '123-145',
        DOI: '10.1234/test.2023.001',
        abstractNote: 'This is a test abstract for automated testing.',
        tags: ['machine-learning', 'automation']
      };
    }
  };

  // ============================================================================
  // TESTS: PDFProcessor.extractMetadata()
  // ============================================================================

  TestRunner.test('PDFProcessor: Module loads correctly', async () => {
    const ztoolkit = TestUtils.getZtoolkit();
    assert.exists(ztoolkit, 'ztoolkit should exist');

    // Try to access PDFProcessor
    const { PDFProcessor } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );
    assert.exists(PDFProcessor, 'PDFProcessor should be importable');
  });

  TestRunner.test('PDFProcessor: Creates instance', async () => {
    const ztoolkit = TestUtils.getZtoolkit();
    const { PDFProcessor } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const processor = new PDFProcessor(ztoolkit);
    assert.exists(processor, 'PDFProcessor instance should exist');
    assert.exists(processor.extractMetadata, 'extractMetadata method should exist');
    assert.exists(processor.extractText, 'extractText method should exist');
  });

  // Note: This test requires an actual PDF file
  TestRunner.test('PDFProcessor: extractMetadata returns object', async () => {
    const ztoolkit = TestUtils.getZtoolkit();
    const { PDFProcessor } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const processor = new PDFProcessor(ztoolkit);

    // This will fail gracefully if file doesn't exist
    try {
      const metadata = await processor.extractMetadata(TestUtils.getTestPDFPath());
      assert.isObject(metadata, 'Metadata should be an object');
      TestRunner.log(`  ℹ Extracted metadata: ${JSON.stringify(metadata)}`, 'cyan');
    } catch (e) {
      TestRunner.log(`  ⚠ Skipping: No test PDF available (${e.message})`, 'yellow');
      TestRunner.results.skipped++;
      throw new Error('SKIP: No test PDF');
    }
  });

  // ============================================================================
  // TESTS: PDFMetadataExtractor
  // ============================================================================

  TestRunner.test('PDFMetadataExtractor: Module loads correctly', async () => {
    const { PDFMetadataExtractor } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );
    assert.exists(PDFMetadataExtractor, 'PDFMetadataExtractor should be importable');
  });

  TestRunner.test('PDFMetadataExtractor: Creates instance', async () => {
    const ztoolkit = TestUtils.getZtoolkit();
    const { PDFMetadataExtractor } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const extractor = new PDFMetadataExtractor(ztoolkit);
    assert.exists(extractor, 'PDFMetadataExtractor instance should exist');
    assert.exists(extractor.extractMetadata, 'extractMetadata method should exist');
    assert.exists(extractor.terminate, 'terminate method should exist');
  });

  TestRunner.test('PDFMetadataExtractor: Handles missing file gracefully', async () => {
    const ztoolkit = TestUtils.getZtoolkit();
    const { PDFMetadataExtractor } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const extractor = new PDFMetadataExtractor(ztoolkit);
    const metadata = await extractor.extractMetadata('/nonexistent/file.pdf');

    // Should return empty object, not throw
    assert.isObject(metadata, 'Should return object even for missing file');
  });

  // ============================================================================
  // TESTS: ZoteroMetadataRetriever
  // ============================================================================

  TestRunner.test('ZoteroMetadataRetriever: Module loads correctly', async () => {
    const { ZoteroMetadataRetriever } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );
    assert.exists(ZoteroMetadataRetriever, 'ZoteroMetadataRetriever should be importable');
  });

  TestRunner.test('ZoteroMetadataRetriever: Creates instance', async () => {
    const ztoolkit = TestUtils.getZtoolkit();
    const { ZoteroMetadataRetriever } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const retriever = new ZoteroMetadataRetriever(ztoolkit);
    assert.exists(retriever, 'ZoteroMetadataRetriever instance should exist');
    assert.exists(retriever.retrieveFromPDF, 'retrieveFromPDF method should exist');
    assert.exists(retriever.retrieveFromDOI, 'retrieveFromDOI method should exist');
    assert.exists(retriever.retrieveFromISBN, 'retrieveFromISBN method should exist');
    retriever.terminate();
  });

  TestRunner.test('ZoteroMetadataRetriever: retrieveFromDOI handles invalid DOI', async () => {
    const ztoolkit = TestUtils.getZtoolkit();
    const { ZoteroMetadataRetriever } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const retriever = new ZoteroMetadataRetriever(ztoolkit, 5000); // 5s timeout
    const metadata = await retriever.retrieveFromDOI('invalid-doi-12345');

    // Should return null for invalid DOI, not throw
    assert.isNull(metadata, 'Should return null for invalid DOI');
    retriever.terminate();
  });

  // ============================================================================
  // TESTS: ItemCreator
  // ============================================================================

  TestRunner.test('ItemCreator: Module loads correctly', async () => {
    const { ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );
    assert.exists(ItemCreator, 'ItemCreator should be importable');
  });

  TestRunner.test('ItemCreator: Creates instance', async () => {
    const { ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const creator = new ItemCreator();
    assert.exists(creator, 'ItemCreator instance should exist');
    assert.exists(creator.createItemFromPDF, 'createItemFromPDF method should exist');
    assert.exists(creator.enrichExistingItem, 'enrichExistingItem method should exist');
  });

  TestRunner.test('ItemCreator: enrichExistingItem fills empty fields', async () => {
    const { ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    // Create test item with minimal data
    const item = await TestUtils.createTestItem('journalArticle');
    item.setField('title', 'Original Title');
    await item.saveTx();

    const itemKey = item.key;

    try {
      // Enrich with mock metadata
      const creator = new ItemCreator();
      const metadata = TestUtils.getMockRetrievedMetadata();
      delete metadata.title; // Don't overwrite existing title

      const result = await creator.enrichExistingItem(itemKey, metadata, null, false);

      assert.exists(result, 'Result should exist');
      assert.hasProperty(result, 'fieldsUpdated', 'Should have fieldsUpdated');
      assert.hasProperty(result, 'fieldsSkipped', 'Should have fieldsSkipped');
      assert.isArray(result.fieldsUpdated, 'fieldsUpdated should be array');

      // Verify title was NOT overwritten
      const updatedItem = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        itemKey
      );
      assert.equals(updatedItem.getField('title'), 'Original Title', 'Title should not be overwritten');

      TestRunner.log(`  ℹ Fields updated: ${result.fieldsUpdated.join(', ')}`, 'cyan');
      TestRunner.log(`  ℹ Fields skipped: ${result.fieldsSkipped.join(', ')}`, 'cyan');

    } finally {
      // Clean up
      await TestUtils.deleteTestItem(itemKey);
    }
  });

  TestRunner.test('ItemCreator: enrichExistingItem with overwrite updates fields', async () => {
    const { ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    // Create test item with data
    const item = await TestUtils.createTestItem('journalArticle');
    item.setField('title', 'Original Title');
    item.setField('date', '2020');
    await item.saveTx();

    const itemKey = item.key;

    try {
      // Enrich with overwrite enabled
      const creator = new ItemCreator();
      const metadata = {
        title: 'New Title',
        date: '2023',
        itemType: 'journalArticle'
      };

      const result = await creator.enrichExistingItem(itemKey, metadata, null, true);

      // Verify fields were overwritten
      const updatedItem = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        itemKey
      );
      assert.equals(updatedItem.getField('title'), 'New Title', 'Title should be overwritten');
      assert.equals(updatedItem.getField('date'), '2023', 'Date should be overwritten');

      assert.isTrue(result.fieldsUpdated.includes('title'), 'title should be in fieldsUpdated');

    } finally {
      await TestUtils.deleteTestItem(itemKey);
    }
  });

  TestRunner.test('ItemCreator: enrichExistingItem handles non-existent item', async () => {
    const { ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const creator = new ItemCreator();

    try {
      await creator.enrichExistingItem('NONEXISTENT123', {}, null, false);
      assert.isTrue(false, 'Should have thrown error for non-existent item');
    } catch (e) {
      assert.isTrue(e.message.includes('not found') || e.message.includes('未找到'), 'Should throw appropriate error');
    }
  });

  // ============================================================================
  // TESTS: Integration Tests
  // ============================================================================

  TestRunner.test('Integration: Create item with metadata merging', async () => {
    const { ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    // Simulate having both web metadata and PDF metadata
    const webMetadata = {
      itemType: 'journalArticle',
      title: 'Web Title',
      DOI: '10.1234/web.001',
      creators: [{ firstName: 'John', lastName: 'Web', creatorType: 'author' }]
    };

    const pdfMetadata = {
      title: 'PDF Title', // Should be ignored (web takes priority)
      keywords: ['pdf-keyword'],
      subject: 'PDF abstract'
    };

    const creator = new ItemCreator();

    // Note: This test will fail without a real PDF, but tests the logic
    TestRunner.log('  ℹ This test requires actual PDF file - skipping', 'yellow');
    TestRunner.results.skipped++;
    throw new Error('SKIP: Requires PDF file');
  });

  TestRunner.test('Integration: Metadata source tracking', async () => {
    const { ItemCreator } = ChromeUtils.import(
      'chrome://zotero-mcp-ext/content/scripts/zotero-mcp-ext.js'
    );

    const item = await TestUtils.createTestItem('journalArticle');
    const itemKey = item.key;

    try {
      const creator = new ItemCreator();
      const metadata = {
        itemType: 'journalArticle',
        title: 'Test Title',
        DOI: '10.1234/test.001'
      };

      const result = await creator.enrichExistingItem(itemKey, metadata, null, true);

      assert.hasProperty(result, 'metadataSources', 'Should have metadataSources');
      assert.hasProperty(result.metadataSources, 'webService', 'Should track web service sources');
      assert.hasProperty(result.metadataSources, 'pdfProperties', 'Should track PDF property sources');
      assert.hasProperty(result.metadataSources, 'manual', 'Should track manual sources');

    } finally {
      await TestUtils.deleteTestItem(itemKey);
    }
  });

  // ============================================================================
  // RUN ALL TESTS
  // ============================================================================

  TestRunner.log('\n🔧 Initializing test environment...\n', 'cyan');

  // Verify plugin is loaded
  if (!Zotero.ZoteroMCPExt) {
    TestRunner.log('❌ ERROR: Zotero MCP Plugin not loaded!', 'red');
    TestRunner.log('Please ensure the plugin is installed and enabled.', 'red');
    return;
  }

  TestRunner.log('✓ Zotero MCP Plugin detected', 'green');
  TestRunner.log(`✓ Zotero version: ${Zotero.version}`, 'green');
  TestRunner.log(`✓ Library ID: ${Zotero.Libraries.userLibraryID}`, 'green');

  // Run all tests
  await TestRunner.run();

  return TestRunner.results;

})().catch(error => {
  Zotero.debug('❌ Test suite error: ' + error, 'error');
  Zotero.debug(error.stack, 'error');
  throw error;
});
