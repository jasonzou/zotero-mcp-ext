/**
 * Test Helpers and Utilities
 * Run in Zotero Developer Console
 *
 * Provides helper functions for testing PDF metadata tools
 */

const TestHelpers = {

  /**
   * Create a test item with specified metadata
   */
  async createTestItem(metadata = {}) {
    const itemType = metadata.itemType || 'journalArticle';
    const item = new Zotero.Item(itemType);
    item.libraryID = Zotero.Libraries.userLibraryID;

    // Set fields
    if (metadata.title) item.setField('title', metadata.title);
    if (metadata.date) item.setField('date', metadata.date);
    if (metadata.abstractNote) item.setField('abstractNote', metadata.abstractNote);
    if (metadata.publicationTitle) item.setField('publicationTitle', metadata.publicationTitle);
    if (metadata.volume) item.setField('volume', metadata.volume);
    if (metadata.issue) item.setField('issue', metadata.issue);
    if (metadata.pages) item.setField('pages', metadata.pages);
    if (metadata.DOI) item.setField('DOI', metadata.DOI);
    if (metadata.url) item.setField('url', metadata.url);

    // Set creators
    if (metadata.creators) {
      item.setCreators(metadata.creators);
    }

    // Set tags
    if (metadata.tags) {
      item.setTags(metadata.tags.map(t => ({ tag: t })));
    }

    const itemID = await item.saveTx();

    console.log(`✓ Created test item: ${item.key}`);
    console.log(`  Title: ${item.getField('title')}`);
    console.log(`  Type: ${item.itemType}`);

    return item;
  },

  /**
   * Delete test item
   */
  async deleteTestItem(itemKey) {
    const item = Zotero.Items.getByLibraryAndKey(
      Zotero.Libraries.userLibraryID,
      itemKey
    );
    if (item) {
      await item.eraseTx();
      console.log(`✓ Deleted test item: ${itemKey}`);
    }
  },

  /**
   * Create a collection for testing
   */
  async createTestCollection(name = 'MCP Test Collection') {
    const collection = new Zotero.Collection();
    collection.libraryID = Zotero.Libraries.userLibraryID;
    collection.name = name;
    await collection.saveTx();

    console.log(`✓ Created test collection: ${collection.key}`);
    console.log(`  Name: ${collection.name}`);

    return collection;
  },

  /**
   * Delete test collection
   */
  async deleteTestCollection(collectionKey) {
    const collection = Zotero.Collections.getByLibraryAndKey(
      Zotero.Libraries.userLibraryID,
      collectionKey
    );
    if (collection) {
      await collection.eraseTx();
      console.log(`✓ Deleted test collection: ${collectionKey}`);
    }
  },

  /**
   * Mock PDF metadata
   */
  getMockPDFMetadata() {
    return {
      title: 'Machine Learning Approaches for Automated Testing',
      author: 'John Doe, Jane Smith',
      subject: 'This paper presents novel machine learning approaches for automated software testing, including deep learning models for test case generation and optimization.',
      keywords: ['machine-learning', 'automated-testing', 'neural-networks', 'test-generation'],
      creator: 'LaTeX with hyperref',
      producer: 'pdfTeX-1.40.21',
      creationDate: '2023-01-15T12:00:00.000Z',
      modificationDate: '2023-01-15T14:30:00.000Z',
      pageCount: 12
    };
  },

  /**
   * Mock retrieved metadata from web service
   */
  getMockRetrievedMetadata() {
    return {
      itemType: 'journalArticle',
      title: 'Machine Learning Approaches for Automated Testing',
      creators: [
        { firstName: 'John', lastName: 'Doe', creatorType: 'author' },
        { firstName: 'Jane', lastName: 'Smith', creatorType: 'author' }
      ],
      date: '2023',
      publicationTitle: 'IEEE Transactions on Software Engineering',
      volume: '49',
      issue: '3',
      pages: '1234-1256',
      DOI: '10.1109/TSE.2023.1234567',
      abstractNote: 'This paper presents novel machine learning approaches for automated software testing. We introduce deep learning models for test case generation and optimization, achieving state-of-the-art results on benchmark datasets.',
      tags: ['machine-learning', 'automated-testing', 'test-generation', 'deep-learning'],
      url: 'https://ieeexplore.ieee.org/document/12345678',
      language: 'en',
      ISSN: '0098-5589'
    };
  },

  /**
   * Test metadata extraction from a real PDF
   */
  async testPDFExtraction(pdfPath) {
    console.log(`\n📄 Testing PDF Extraction: ${pdfPath}\n`);

    const ztoolkit = Zotero.ZoteroMCP.addon.ztoolkit;
    const { PDFMetadataExtractor } = ChromeUtils.import(
      'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
    );

    const extractor = new PDFMetadataExtractor(ztoolkit);

    try {
      const metadata = await extractor.extractMetadata(pdfPath);

      console.log('📊 Extracted Metadata:');
      console.log('  Title:', metadata.title || '(none)');
      console.log('  Author:', metadata.author || '(none)');
      console.log('  Subject:', metadata.subject || '(none)');
      console.log('  Keywords:', metadata.keywords?.join(', ') || '(none)');
      console.log('  Creator:', metadata.creator || '(none)');
      console.log('  Producer:', metadata.producer || '(none)');
      console.log('  Creation Date:', metadata.creationDate || '(none)');
      console.log('  Page Count:', metadata.pageCount || '(none)');

      return metadata;

    } catch (error) {
      console.error('❌ Extraction failed:', error.message);
      throw error;
    } finally {
      extractor.terminate();
    }
  },

  /**
   * Test web service metadata retrieval
   */
  async testWebServiceRetrieval(doi) {
    console.log(`\n🌐 Testing Web Service Retrieval: DOI ${doi}\n`);

    const ztoolkit = Zotero.ZoteroMCP.addon.ztoolkit;
    const { ZoteroMetadataRetriever } = ChromeUtils.import(
      'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
    );

    const retriever = new ZoteroMetadataRetriever(ztoolkit, 15000); // 15s timeout

    try {
      console.log('Retrieving metadata from Zotero web service...');
      const metadata = await retriever.retrieveFromDOI(doi);

      if (metadata) {
        console.log('✓ Retrieved Metadata:');
        console.log('  Title:', metadata.title);
        console.log('  Type:', metadata.itemType);
        console.log('  Authors:', metadata.creators?.map(c => `${c.firstName} ${c.lastName}`).join(', ') || '(none)');
        console.log('  Date:', metadata.date || '(none)');
        console.log('  Publication:', metadata.publicationTitle || '(none)');
        console.log('  DOI:', metadata.DOI || '(none)');
        console.log('  Abstract:', metadata.abstractNote?.substring(0, 100) + '...' || '(none)');
      } else {
        console.log('⚠ No metadata found for DOI');
      }

      return metadata;

    } catch (error) {
      console.error('❌ Retrieval failed:', error.message);
      throw error;
    } finally {
      retriever.terminate();
    }
  },

  /**
   * Compare two metadata objects
   */
  compareMetadata(meta1, meta2) {
    console.log('\n🔍 Metadata Comparison:\n');

    const fields = new Set([
      ...Object.keys(meta1 || {}),
      ...Object.keys(meta2 || {})
    ]);

    console.log('Field                 | Source 1              | Source 2');
    console.log('-'.repeat(70));

    for (const field of fields) {
      const val1 = meta1?.[field] || '(empty)';
      const val2 = meta2?.[field] || '(empty)';

      const val1Str = typeof val1 === 'object' ? JSON.stringify(val1) : String(val1);
      const val2Str = typeof val2 === 'object' ? JSON.stringify(val2) : String(val2);

      const val1Short = val1Str.substring(0, 20).padEnd(20);
      const val2Short = val2Str.substring(0, 20).padEnd(20);

      const match = val1Str === val2Str ? '✓' : '✗';

      console.log(`${field.padEnd(20)} | ${val1Short} | ${val2Short} ${match}`);
    }
  },

  /**
   * Create a complete test scenario
   */
  async runCompleteScenario(pdfPath) {
    console.log('\n🎯 Running Complete Test Scenario\n');
    console.log('='.repeat(70));

    const ztoolkit = Zotero.ZoteroMCP.addon.ztoolkit;
    const {
      PDFMetadataExtractor,
      ZoteroMetadataRetriever,
      ItemCreator
    } = ChromeUtils.import(
      'chrome://zotero-mcp-plugin/content/scripts/zotero-mcp-plugin.js'
    );

    let itemKey = null;

    try {
      // Step 1: Extract PDF metadata
      console.log('\n📄 Step 1: Extracting PDF metadata...');
      const pdfExtractor = new PDFMetadataExtractor(ztoolkit);
      const pdfMetadata = await pdfExtractor.extractMetadata(pdfPath);
      console.log('  ✓ PDF metadata extracted');
      pdfExtractor.terminate();

      // Step 2: Retrieve web metadata (if PDF has DOI)
      console.log('\n🌐 Step 2: Retrieving web metadata...');
      let webMetadata = null;

      // Try to extract DOI from PDF metadata or text
      // For demo, we'll skip this and use mock data
      console.log('  ℹ Using mock web metadata for demo');
      webMetadata = this.getMockRetrievedMetadata();

      // Step 3: Create item
      console.log('\n📝 Step 3: Creating Zotero item...');
      const creator = new ItemCreator();
      const result = await creator.createItemFromPDF(
        pdfPath,
        null, // No collection
        webMetadata,
        pdfMetadata
      );

      itemKey = result.itemKey;
      console.log(`  ✓ Item created: ${result.itemKey}`);
      console.log(`  Fields set: ${result.fieldsSet.join(', ')}`);
      console.log('\n  Metadata sources:');
      console.log(`    Web service: ${result.metadataSources.webService.join(', ')}`);
      console.log(`    PDF properties: ${result.metadataSources.pdfProperties.join(', ')}`);
      console.log(`    Manual: ${result.metadataSources.manual.join(', ')}`);

      // Step 4: Verify item
      console.log('\n✅ Step 4: Verifying created item...');
      const item = Zotero.Items.getByLibraryAndKey(
        Zotero.Libraries.userLibraryID,
        result.itemKey
      );

      console.log(`  Title: ${item.getField('title')}`);
      console.log(`  Type: ${item.itemType}`);
      console.log(`  DOI: ${item.getField('DOI') || '(none)'}`);
      console.log(`  Date: ${item.getField('date') || '(none)'}`);

      console.log('\n' + '='.repeat(70));
      console.log('✅ Complete scenario finished successfully!');
      console.log('='.repeat(70));

      return { success: true, itemKey: result.itemKey };

    } catch (error) {
      console.error('\n❌ Scenario failed:', error.message);
      console.error(error.stack);
      return { success: false, error: error.message };

    } finally {
      // Clean up
      if (itemKey) {
        console.log(`\n🧹 Cleaning up test item: ${itemKey}`);
        await this.deleteTestItem(itemKey);
      }
    }
  },

  /**
   * Display all available test helpers
   */
  help() {
    console.log('\n📚 Available Test Helpers:\n');
    console.log('TestHelpers.createTestItem(metadata)        - Create test item');
    console.log('TestHelpers.deleteTestItem(itemKey)         - Delete test item');
    console.log('TestHelpers.createTestCollection(name)      - Create test collection');
    console.log('TestHelpers.deleteTestCollection(key)       - Delete test collection');
    console.log('TestHelpers.getMockPDFMetadata()            - Get mock PDF metadata');
    console.log('TestHelpers.getMockRetrievedMetadata()      - Get mock web metadata');
    console.log('TestHelpers.testPDFExtraction(pdfPath)      - Test PDF extraction');
    console.log('TestHelpers.testWebServiceRetrieval(doi)    - Test DOI lookup');
    console.log('TestHelpers.compareMetadata(meta1, meta2)   - Compare metadata');
    console.log('TestHelpers.runCompleteScenario(pdfPath)    - Run full test scenario');
    console.log('TestHelpers.help()                          - Show this help');
    console.log('\nExample usage:');
    console.log('  const item = await TestHelpers.createTestItem({ title: "Test" });');
    console.log('  await TestHelpers.deleteTestItem(item.key);');
    console.log('  const metadata = await TestHelpers.testPDFExtraction("/path/to/paper.pdf");');
  }
};

// Auto-display help when loaded
TestHelpers.help();

// Make available globally
this.TestHelpers = TestHelpers;

console.log('\n✓ Test helpers loaded. Use TestHelpers.help() to see available functions.\n');
