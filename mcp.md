# Zotero MCP Functions

This document lists all MCP tools provided by the Zotero MCP Plugin.

## Tool List

### 1. search_library
Search the Zotero library with advanced parameters.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | General search query |
| `title` | string | Title search |
| `titleOperator` | string | `contains`, `exact`, `startsWith`, `endsWith`, `regex` |
| `yearRange` | string | Year range (e.g., "2020-2023") |
| `fulltext` | string | Full-text search in attachments and notes |
| `fulltextMode` | string | `attachment`, `note`, `both` |
| `fulltextOperator` | string | `contains`, `exact`, `regex` |
| `mode` | string | `minimal` (30), `preview` (100), `standard` (200), `complete` (500+) |
| `relevanceScoring` | boolean | Enable relevance scoring |
| `sort` | string | `relevance`, `date`, `title`, `year` |
| `limit` | number | Maximum results to return |
| `offset` | number | Pagination offset |

---

### 2. search_annotations
Search annotations and notes with intelligent ranking.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required) |
| `itemKeys` | string[] | Limit search to specific items |
| `types` | string[] | `note`, `highlight`, `annotation`, `ink`, `text`, `image` |
| `mode` | string | `standard`, `preview`, `complete`, `minimal` |
| `maxTokens` | number | Token budget |
| `minRelevance` | number | Minimum relevance threshold (0-1, default: 0.1) |
| `limit` | number | Maximum results (default: 15) |
| `offset` | number | Pagination offset |

---

### 3. get_item_details
Get detailed information for a specific item.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `itemKey` | string | Unique item key (required) |
| `mode` | string | `minimal`, `preview`, `standard`, `complete` |

---

### 4. get_annotations
Get annotations and notes with intelligent content management.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `itemKey` | string | Get all annotations for this item |
| `annotationId` | string | Get specific annotation by ID |
| `annotationIds` | string[] | Get multiple annotations by IDs |
| `types` | string[] | `note`, `highlight`, `annotation`, `ink`, `text`, `image` (default: note, highlight, annotation) |
| `mode` | string | `standard`, `preview`, `complete`, `minimal` |
| `maxTokens` | number | Token budget |
| `limit` | number | Maximum results (default: 20) |
| `offset` | number | Pagination offset |

---

### 5. get_content
Unified content extraction tool for PDFs, attachments, notes, and abstracts.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `itemKey` | string | Item key to get all content from this item |
| `attachmentKey` | string | Attachment key to get content from specific attachment |
| `mode` | string | `minimal` (500 chars), `preview` (1.5K), `standard` (3K), `complete` (unlimited) |
| `include.pdf` | boolean | Include PDF content (default: true) |
| `include.attachments` | boolean | Include other attachments (default: true) |
| `include.notes` | boolean | Include notes content (default: true) |
| `include.abstract` | boolean | Include abstract (default: true) |
| `include.webpage` | boolean | Include webpage snapshots (default: false) |
| `format` | string | `json` or `text` (default: json) |

**Content Control:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `contentControl.preserveOriginal` | boolean | Preserve original text structure (default: true) |
| `contentControl.allowExtended` | boolean | Allow retrieving more content than mode default (default: false) |
| `contentControl.maxContentLength` | number | Override maximum content length |
| `contentControl.prioritizeCompleteness` | boolean | Prioritize complete sentences (default: false) |

---

### 6. get_collections
Get list of all collections in the library.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `mode` | string | `minimal` (20), `preview` (50), `standard` (100), `complete` (500+) |
| `limit` | number | Maximum results to return |
| `offset` | number | Pagination offset |

---

### 7. search_collections
Search collections by name.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Collection name search query |
| `limit` | number | Maximum results to return |

---

### 8. get_collection_details
Get detailed information about a specific collection.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `collectionKey` | string | Collection key (required) |

---

### 9. get_collection_items
Get items in a specific collection.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `collectionKey` | string | Collection key (required) |
| `limit` | number | Maximum results to return |
| `offset` | number | Pagination offset |

---

### 10. get_subcollections
Get subcollections (child collections) of a specific collection.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `collectionKey` | string | Parent collection key (required) |
| `limit` | number | Maximum results (default: 100) |
| `offset` | number | Pagination offset (default: 0) |
| `recursive` | boolean | Include subcollection count (default: false) |

---

### 11. search_fulltext
Search within fulltext content of items.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (required) |
| `itemKeys` | string[] | Limit search to specific items |
| `mode` | string | `minimal` (100 context), `preview` (200), `standard` (adaptive), `complete` (400+) |
| `contextLength` | number | Context length around matches |
| `maxResults` | number | Maximum results to return |
| `caseSensitive` | boolean | Case sensitive search (default: false) |

---

### 12. get_item_abstract
Get the abstract/summary of a specific item.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `itemKey` | string | Item key (required) |
| `format` | string | `json` or `text` (default: json) |

---

### 13. get_item_citation
Generate a citation for a specific item in various CSL styles.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `itemKey` | string | Item key (required) |
| `style` | string | Citation style: `apa`, `chicago-author-date`, `harvard1`, `ieee`, `mla`, `nature`, `vancouver`, `bibtex` (default: apa) |
| `format` | string | Output format: `html`, `text`, `bibtex` (default: text) |
| `itemKeys` | string[] | Multiple item keys for batch mode |

**Available Styles:**
| Style | Name |
|-------|------|
| `apa` | APA (7th edition) |
| `chicago-author-date` | Chicago (Author-Date) |
| `harvard1` | Harvard |
| `ieee` | IEEE |
| `mla` | MLA (9th edition) |
| `nature` | Nature |
| `vancouver` | Vancouver |
| `bibtex` | BibTeX |

**Response:**
```json
{
  "itemKey": "ABCD1234",
  "title": "Paper Title",
  "style": "apa",
  "styleName": "APA (7th edition)",
  "format": "text",
  "citation": "Author, A. A. (2023). Paper title. Journal Name, 10(2), 1-10.",
  "bibtex": "@article{author2023paper,\n  author = {Author, A. A.},\n  title = {Paper title},\n  year = {2023},\n  journal = {Journal Name}\n}",
  "metadata": { ... },
  "generatedAt": "2024-01-01T00:00:00.000Z",
  "processingTime": "15ms"
}
```

---

## Response Format

All tools return responses wrapped in a unified structure:

```json
{
  "data": { ... },
  "metadata": {
    "extractedAt": "ISO timestamp",
    "toolName": "tool_name",
    "responseType": "search|content|annotation|collection|text|object|array",
    "toolGuidance": {
      "dataStructure": { ... },
      "interpretation": { ... },
      "usage": [ ... ]
    }
  }
}
```

## HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint |
| `/mcp/status` | GET | Server status and capabilities |
| `/capabilities` | GET | API documentation |
| `/ping` | GET | Health check |
