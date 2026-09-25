---
name: zotero-mcp
description: Communicate with Zotero from the command line on Windows/macOS/Linux via the zotero-mcp plugin. Use for single-PDF import, folder batch import, importing into an existing collection, listing collections, and verifying connector health. Full MCP integration for full-text search, semantic search, notes, tags, and metadata editing. Requires Zotero desktop with zotero-mcp-plugin installed.
---

# Zotero Local Import & MCP Skill (Windows / macOS / Linux)

This skill provides unified operation for PDF import, item import, PDF filing, and library management via the [zotero-mcp](https://github.com/cookjohn/zotero-mcp) plugin, driven by a single zero-dependency Node script.

## Prerequisites

Before using this skill, make sure the runtime and Zotero Desktop are ready:

### Node Runtime

- Node.js **>= 18** on `PATH` (the script uses Node built-ins and global `fetch` only — no `npm install`, no pip, no dependencies)

### MCP Server Setup
1. Install the [zotero-mcp-plugin](https://github.com/cookjohn/zotero-mcp/releases) in Zotero 7+
   - Download `.xpi` file from Releases
   - Zotero → Tools → Add-ons → Install Add-on From File
2. Restart Zotero
3. Open **Zotero → Edit → Preferences → Zotero MCP Plugin**
4. Enable **Start integrated MCP server**
5. Note the MCP port (default `23120`)

### Zotero Local Connector (port 23119)
PDF imports are proxied through Zotero's Local Connector (port 23119), and `push` / `list-collections` talk to it directly. Ensure:
1. Open **Zotero → Settings → Advanced**
2. Enable: **Allow other applications on this computer to communicate with Zotero**

> This skill only imports into **existing collections**. It does **not** create collections.
> If `--collection` is not provided, imports default to **My Library**.

## Script location

- `zotero-skill/scripts/zotero.mjs` (single entry point; replaces the older `zotero_tool.py` / `zotero_tool.ts` / `push_to_zotero.py`)

### Three transports

| Transport  | Endpoint                    | Used for                                        |
| ---------- | --------------------------- | ----------------------------------------------- |
| MCP        | `http://HOST:23120/mcp`     | JSON-RPC `tools/call` to the zotero-mcp plugin  |
| Connector  | `http://HOST:23119/connector` | Zotero desktop Connector API (RIS/items/PDF)  |
| Local API  | `http://HOST:23119/api/...` | Zotero 7 local API (authorized writes, listing) |

## Features

The three ways to load a PDF are always tried in order **1 → 2 → 3** with automatic fallback (see "PDF loading fallback chain" below).

### Way 1 — PDF Import (via MCP `import_pdf` tool)
1. Import a single PDF
2. Import all PDFs in a folder (optional recursive mode)
3. Import into an existing collection
4. List local Zotero collections (local API or MCP)
5. Check connector health (`mcp-health`)

> **Size limit**: `import` / `mcp-import-pdf` base64-encodes the PDF into a JSON-RPC body, and the plugin caps requests at 50 MB — PDFs up to ~35 MB import fine. Larger PDFs fail here; the chain then falls back to Way 2.

### Way 2 — PDF Filing (via MCP `write_item` action="import")
1. Resolve an existing item by DOI (never creates duplicates)
2. Create the parent item from a metadata JSON file when needed
3. Attach the PDF from a local path (no payload size limit)
4. Add to the target collection and verify from the collection itself

### Way 3 — Item Import + PDF download (Connector / local API, port 23119)
1. Push RIS data (file or string) into Zotero
2. Push structured JSON items with a PDF downloaded from `pdfUrl` (+ optional `cookies`)
3. `--dry-run` preview, `--local-api` backend, duplicate-safe (HTTP 409 = already saved)

### MCP Server Operations (port 23120)
1. **Search & Query**: Full-text search, annotation search, metadata search
2. **Semantic Search**: AI-powered concept matching (requires OpenAI/Ollama)
3. **Collection Management**: Browse collections, subcollections, items
4. **Note Management**: Create, read notes (Markdown → HTML)
5. **Tag Management**: Add, remove, replace tags on items
6. **Metadata Editing**: Update titles, abstracts, DOI, URL, date, creators
7. **Item Creation**: Create new items or reparent standalone PDFs
8. **Content Extraction**: Get PDF full-text, abstracts, webpage snapshots

## Agent pre-execution contract (foolproof mode)

The agent must support all of the following user input forms and complete import automatically:

1. A folder path
2. A single PDF path
3. Multiple PDF paths
4. A few PDFs inside a folder (user can provide file names such as `x.pdf, y.pdf, z.pdf`)

The agent must also collect:

- Zotero MCP port (default: 23120)
- Optional collection name (if omitted, default to My Library)

Required execution flow for PDF imports:

1. Run `mcp-health` to verify the MCP server and connector
2. Load each PDF through the mandatory fallback chain: **Way 1 (`import`) → Way 2 (`file`) → Way 3 (`push`)** — move to the next way only when the current one fails (see "PDF loading fallback chain" below)
3. Verify the result before reporting success

Natural-language parsing (paths, file names, port, collection) must be handled by the **agent**, not by the script. The script accepts structured arguments only.

## PDF loading fallback chain (mandatory: 1 → 2 → 3)

The agent must load every PDF by trying the three ways **in order**, moving to the next way only after the current one fails:

| Way | Command | Strengths | Hard limits |
| --- | ------- | --------- | ----------- |
| 1. Direct import | `import` | simplest; batch (`--dir`, `--pick`); collection targeting | base64 over MCP — PDFs > ~35 MB rejected (50 MB request cap) |
| 2. Filing | `file` | no size limit; DOI dedupe; built-in verify | needs a parent item (`--doi` and/or `--metadata`); one PDF per call |
| 3. Item import + download | `push --json` | creates the item and attaches a PDF from a URL | PDF must be downloadable via `pdfUrl` (paywalled hosts need `cookies`); local files cannot be attached this way |

**Failure** = the command exits non-zero, or its output contains `fail=`, `summary=INCOMPLETE`, or `Failed:`.

Chain rules:

1. Start with Way 1 for every PDF.
2. If Way 1 fails for a PDF, retry that PDF with Way 2:
   - pass `--doi` when the DOI is known (reuses an existing item, never duplicates)
   - if Way 2 exits with "no existing item matched and no --metadata given", build a metadata JSON (title/DOI/creators from the citation at hand) and retry Way 2 once
3. If Way 2 also fails, fall back to Way 3: build a JSON paper object (`title`, `authors`, `doi`, `pdfUrl`, optional `cookies`/`pdfReferer`) and `push` it with `--collection`. If no usable `pdfUrl` exists, push the metadata only (PDF skipped) and tell the user.
4. Before retrying a PDF in a later way, check whether an earlier way already created the item (`find --doi` or `mcp-search` by title) to avoid duplicates.
5. Report the per-PDF outcome: which way succeeded, or that all three ways failed.

## Command usage

Run from repository root (or use absolute script path):

```bash
node zotero-skill/scripts/zotero.mjs --help
```

### 0) Environment check (mandatory)

```bash
node zotero-skill/scripts/zotero.mjs mcp-health --mcp-port <MCP_PORT>
```

This checks:

- Node runtime (prints executable path and version)
- MCP server ping (`http://127.0.0.1:<mcp-port>/mcp`), plus a debug list of available MCP tools
- Zotero Local Connector health via direct ping on port 23119 (falls back to the MCP `connector_health` proxy tool)

Exit code `11` means the doctor check failed. There are **no dependencies to auto-install**; if the MCP server is unreachable, verify the plugin is installed and the integrated MCP server is enabled, then re-run.

---

## PDF Import Commands (Way 1)

> First way in the fallback chain. Best for PDFs up to ~35 MB; on failure fall back to Way 2 (`file`), then Way 3 (`push`).

### NL) Natural-language input policy (agent-side parsing only)

Users may say things like:

- "Import `x.pdf, y.pdf, z.pdf` from `<folder>`, port `xxxx`, collection `xxxx`"
- "Import this PDF: `<absolute path>`, port `xxxx`"

The agent must convert NL input into structured CLI args, then call `import`:

- Folder mode: `--dir` + optional `--pick`
- Single/multiple PDF mode: repeated `--pdf`
- Port: `--mcp-port`
- Collection: optional `--collection` (defaults to My Library)

`--pdf` and `--dir` are mutually exclusive; `--pick` only works with `--dir`.

### A) Import a single PDF

```bash
node zotero-skill/scripts/zotero.mjs import \
  --pdf "<ABSOLUTE_PDF_PATH>" \
  --mcp-port <MCP_PORT>
```

### A2) Import multiple PDFs (repeat `--pdf`)

```bash
node zotero-skill/scripts/zotero.mjs import \
  --pdf "<PDF_PATH_1>" \
  --pdf "<PDF_PATH_2>" \
  --pdf "<PDF_PATH_3>" \
  --mcp-port <MCP_PORT>
```

### B) Batch import a folder (non-recursive)

```bash
node zotero-skill/scripts/zotero.mjs import \
  --dir "<ABSOLUTE_FOLDER_PATH>" \
  --mcp-port <MCP_PORT>
```

### C) Batch import a folder (recursive)

```bash
node zotero-skill/scripts/zotero.mjs import \
  --dir "<ABSOLUTE_FOLDER_PATH>" \
  --recursive \
  --mcp-port <MCP_PORT>
```

### D) Import into a specific existing collection

```bash
node zotero-skill/scripts/zotero.mjs import \
  --dir "<ABSOLUTE_FOLDER_PATH>" \
  --recursive \
  --collection "<EXISTING_COLLECTION_NAME>" \
  --mcp-port <MCP_PORT>
```

### D2) Import selected PDFs from a folder (CSV file names)

```bash
node zotero-skill/scripts/zotero.mjs import \
  --dir "<ABSOLUTE_FOLDER_PATH>" \
  --pick "x.pdf,y.pdf,z.pdf" \
  --collection "<EXISTING_COLLECTION_NAME>" \
  --mcp-port <MCP_PORT>
```

Or repeat `--pick`:

```bash
node zotero-skill/scripts/zotero.mjs import \
  --dir "<ABSOLUTE_FOLDER_PATH>" \
  --pick "x.pdf" \
  --pick "y.pdf" \
  --pick "z.pdf" \
  --mcp-port <MCP_PORT>
```

### E) List local collections

Via the Zotero local API (port 23119, prints `<key>\t<name>`):

```bash
node zotero-skill/scripts/zotero.mjs list-collections
```

Via MCP (port 23120, JSON output):

```bash
node zotero-skill/scripts/zotero.mjs mcp-collections --mcp-port <MCP_PORT>
```

### F) Check connector health (via MCP)

```bash
node zotero-skill/scripts/zotero.mjs mcp-health --mcp-port <MCP_PORT>
```

---

## PDF Filing Commands (Way 2)

> **Why not `import`?** The plugin caps MCP request bodies at 50 MB (≈35 MB PDFs), so `import` fails on anything larger with HTTP 400 / JSON-RPC `-32700 Parse error`. `file` uses the plugin's `write_item` tool with `action="import"`, which reads the path on the Zotero host and sends a tiny request body — no practical size limit. It also dedupes by DOI and verifies the result.
>
> **Constraint**: `write_item action="import"` requires an existing parent item, so the flow is always: resolve parent (by DOI) → create parent (from metadata JSON) if none → attach → verify. Existing PDF attachments are reused unless `--force` is given.

### Check MCP server reachability

```bash
node zotero-skill/scripts/zotero.mjs health --mcp-port <MCP_PORT>
```

### List collections as `<key>\t<path>`

```bash
node zotero-skill/scripts/zotero.mjs collections --mcp-port <MCP_PORT>
```

### Find an item by DOI (exit `3` = not found)

```bash
node zotero-skill/scripts/zotero.mjs find \
  --doi "10.1234/example" \
  --collection "<EXISTING_COLLECTION_NAME>" \
  --mcp-port <MCP_PORT>
```

### File a PDF (resolve-or-create parent, attach, verify)

```bash
node zotero-skill/scripts/zotero.mjs file \
  --pdf "<ABSOLUTE_PDF_PATH>" \
  --collection "<EXISTING_COLLECTION_NAME>" \
  --doi "10.1234/example" \
  --metadata "/path/to/metadata.json" \
  --mcp-port <MCP_PORT>
```

- `--doi` (optional): reuse an existing library item matching this DOI instead of creating one
- `--metadata` (optional): JSON file used to create the parent when no existing item matched; **required** when no DOI match exists
- `--title` (optional): attachment title (default `Full Text PDF`)
- `--force`: attach another PDF even if the parent already has one

Metadata JSON shape:

```json
{
  "itemType": "journalArticle",
  "fields": { "title": "Article Title", "DOI": "10.1234/example", "url": "https://..." },
  "creators": [{ "creatorType": "author", "firstName": "John", "lastName": "Doe" }],
  "tags": ["machine-learning"]
}
```

---

## Item Import Commands (Way 3 — Zotero Connector / local API, port 23119)

> All `push` modes accept `--collection <name>` (must exist), `--dry-run` (works offline), and `--local-api` (use the Zotero 7 local API instead of the Connector backend).

### Push a RIS file

```bash
node zotero-skill/scripts/zotero.mjs push --ris-file "/path/to/export.ris"
```

### Push inline RIS data

```bash
node zotero-skill/scripts/zotero.mjs push --ris-data "TY  - JOUR\nTI  - Title\nER  - "
```

### Push structured JSON (file or stdin)

```bash
node zotero-skill/scripts/zotero.mjs push --json "/path/to/papers.json"
node zotero-skill/scripts/zotero.mjs push "/path/to/papers.json"
cat papers.json | node zotero-skill/scripts/zotero.mjs push
```

JSON input accepts a single paper object, an array of papers, or `{"items": [...]}`. Loose paper data (title/authors/abstract/doi/keywords/pdfUrl...) is normalized into Zotero items; prebuilt items with `itemType` pass through. Fields like `pdfUrl`, `cookies`, `pdfReferer` trigger PDF download + attachment.

### Preview without writing

```bash
node zotero-skill/scripts/zotero.mjs push --json papers.json --dry-run
```

### Show the currently selected collection tree in Zotero

```bash
node zotero-skill/scripts/zotero.mjs push --list
```

---

## MCP Server Commands (Search, Notes, Tags, Metadata)

> All MCP commands require `--mcp-port` (default: 23120)

### Search Commands

#### Search library (multi-dimensional)

```bash
node zotero-skill/scripts/zotero.mjs mcp-search \
  --mcp-port <MCP_PORT> \
  --query "machine learning" \
  --mode "title,creator,year,tags,fulltext" \
  --limit 20
```

#### Search annotations/highlights

```bash
node zotero-skill/scripts/zotero.mjs mcp-search-annotations \
  --mcp-port <MCP_PORT> \
  --query "neural networks" \
  --color "yellow" \
  --tags "important" \
  --limit 10
```

#### Full-text search

```bash
node zotero-skill/scripts/zotero.mjs mcp-search-fulltext \
  --mcp-port <MCP_PORT> \
  --query "transformer architecture" \
  --limit 10
```

#### Semantic search (requires embedding setup)

```bash
node zotero-skill/scripts/zotero.mjs mcp-semantic-search \
  --mcp-port <MCP_PORT> \
  --query "attention mechanisms in NLP" \
  --limit 10
```

#### Find similar items

```bash
node zotero-skill/scripts/zotero.mjs mcp-find-similar \
  --mcp-port <MCP_PORT> \
  --item-key "ABC123XYZ" \
  --limit 10
```

### Item Details Commands

#### Get item details

```bash
node zotero-skill/scripts/zotero.mjs mcp-item-details \
  --mcp-port <MCP_PORT> \
  --item-key "ABC123XYZ"
```

#### Get item abstract (`--format text|json`)

```bash
node zotero-skill/scripts/zotero.mjs mcp-item-abstract \
  --mcp-port <MCP_PORT> \
  --item-key "ABC123XYZ" \
  --format text
```

#### Get content (PDF text, notes, abstracts)

```bash
node zotero-skill/scripts/zotero.mjs mcp-get-content \
  --mcp-port <MCP_PORT> \
  --item-key "ABC123XYZ" \
  --mode "standard"
```

Modes: `minimal`, `preview`, `standard`, `complete`

### Collection Commands

#### List all collections

```bash
node zotero-skill/scripts/zotero.mjs mcp-collections \
  --mcp-port <MCP_PORT>
```

#### Get collection details

```bash
node zotero-skill/scripts/zotero.mjs mcp-collection-details \
  --mcp-port <MCP_PORT> \
  --collection-key "COLLECTION_KEY"
```

#### Get items in collection

```bash
node zotero-skill/scripts/zotero.mjs mcp-collection-items \
  --mcp-port <MCP_PORT> \
  --collection-key "COLLECTION_KEY" \
  --limit 50
```

#### Get subcollections

```bash
node zotero-skill/scripts/zotero.mjs mcp-subcollections \
  --mcp-port <MCP_PORT> \
  --collection-key "COLLECTION_KEY" \
  --recursive
```

### Note Management Commands

#### Create note (Markdown → HTML)

```bash
node zotero-skill/scripts/zotero.mjs mcp-write-note \
  --mcp-port <MCP_PORT> \
  --item-key "PARENT_ITEM_KEY" \
  --note "# My Notes\n\nThis is a markdown note.\n\n- Point 1\n- Point 2"
```

Or from file:

```bash
node zotero-skill/scripts/zotero.mjs mcp-write-note \
  --mcp-port <MCP_PORT> \
  --item-key "PARENT_ITEM_KEY" \
  --note-file "/path/to/notes.md"
```

#### Read note

```bash
node zotero-skill/scripts/zotero.mjs mcp-read-note \
  --mcp-port <MCP_PORT> \
  --note-key "NOTE_KEY"
```

### Tag Management Commands

#### Add tags to item

```bash
node zotero-skill/scripts/zotero.mjs mcp-add-tags \
  --mcp-port <MCP_PORT> \
  --item-key "ITEM_KEY" \
  --tags "machine-learning,deep-learning,transformers"
```

#### Remove tags from item

```bash
node zotero-skill/scripts/zotero.mjs mcp-remove-tags \
  --mcp-port <MCP_PORT> \
  --item-key "ITEM_KEY" \
  --tags "old-tag,obsolete-tag"
```

#### Replace all tags on item

```bash
node zotero-skill/scripts/zotero.mjs mcp-replace-tags \
  --mcp-port <MCP_PORT> \
  --item-key "ITEM_KEY" \
  --tags "new-tag-1,new-tag-2,new-tag-3"
```

### Metadata Commands

#### Update item metadata (any of `--title`, `--abstract`, `--doi`, `--url`, `--date`)

```bash
node zotero-skill/scripts/zotero.mjs mcp-update-metadata \
  --mcp-port <MCP_PORT> \
  --item-key "ITEM_KEY" \
  --title "New Title" \
  --abstract "New abstract text" \
  --doi "10.1234/example"
```

#### Update creators (authors)

```bash
node zotero-skill/scripts/zotero.mjs mcp-update-creators \
  --mcp-port <MCP_PORT> \
  --item-key "ITEM_KEY" \
  --creators '[{"firstName":"John","lastName":"Doe","creatorType":"author"}]'
```

### Item Creation Commands

#### Create new item (`--item-type` required; optional `--title`, `--url`, `--abstract`, `--doi`)

```bash
node zotero-skill/scripts/zotero.mjs mcp-create-item \
  --mcp-port <MCP_PORT> \
  --item-type "journalArticle" \
  --title "Article Title" \
  --url "https://example.com/paper"
```

#### Reparent standalone PDF

```bash
node zotero-skill/scripts/zotero.mjs mcp-reparent-pdf \
  --mcp-port <MCP_PORT> \
  --pdf-key "PDF_ITEM_KEY" \
  --parent-key "PARENT_ITEM_KEY"
```

### Semantic Search Status

```bash
node zotero-skill/scripts/zotero.mjs mcp-semantic-status \
  --mcp-port <MCP_PORT>
```

### Full-text Database Commands

```bash
# List full-text entries
node zotero-skill/scripts/zotero.mjs mcp-fulltext-db \
  --mcp-port <MCP_PORT> \
  --action list \
  --limit 20

# Search full-text database
node zotero-skill/scripts/zotero.mjs mcp-fulltext-db \
  --mcp-port <MCP_PORT> \
  --action search \
  --query "search term" \
  --limit 10

# Get specific item full-text
node zotero-skill/scripts/zotero.mjs mcp-fulltext-db \
  --mcp-port <MCP_PORT> \
  --action get \
  --item-key "ITEM_KEY"

# Get full-text stats
node zotero-skill/scripts/zotero.mjs mcp-fulltext-db \
  --mcp-port <MCP_PORT> \
  --action stats
```

---

## Key parameters

### Global Parameters
- `--mcp-port`: Zotero MCP server port (default: `ZOTERO_MCP_PORT` env var, fallback `23120`)
- `--host`: Zotero host (default: `127.0.0.1`; overridden by `HOST_IP`/`HOST` env or `DOCKER_HOST=tcp://host:port`)
- `--timeout`: HTTP timeout in seconds (default `30` for MCP operations, `90` for `import`, `60` for filing `health`/`collections`/`find`, `120` for `file`)
- `--verbose` / `-v`: debug output to stderr

### Environment Variables
- `ZOTERO_MCP_HOST`: MCP host override
- `ZOTERO_MCP_PORT`: default MCP port
- `ZOTERO_LOCAL`: base URL of the local API/connector (default `http://127.0.0.1:23119`)
- `ZOTERO_API_KEY`: local API key (auto-authorized when absent)

### Common Command Parameters
- `--collection`: target existing collection name
- `--limit`: Result limit for search/list operations (default varies by command)
- `--query`: Search query string
- `--item-key`: Zotero item key (alphanumeric identifier)
- `--collection-key`: Zotero collection key
- `--mode`: Content extraction mode (`minimal`, `preview`, `standard`, `complete`)

### Exit codes
`0` ok | `1` failure | `2` usage | `3` not found | `4` no PDFs / MCP error | `5` partial import failure | `11` doctor (mcp-health) failure | `20` runtime error | `21` invalid input

## Platform notes

- Runtime: Node.js >= 18 (all platforms)
- Windows: supported by default
- macOS: requires `open`
- Linux: requires `xdg-open`

## Failure handling

### MCP Server
- Connection refused / MCP server not reachable: verify zotero-mcp plugin is installed and the integrated MCP server is enabled
- `zotero_connector=fail` in `mcp-health`: verify Zotero desktop is running and Local Connector is enabled
- Write operations disabled: check Zotero MCP preferences to enable write operations
- Semantic search unavailable: verify OpenAI/Ollama embedding API is configured

### Import Failures (`import` / `mcp-import-pdf` — Way 1)
- Any failure → fall back to Way 2 (`file`) per the fallback chain
- HTTP 400 with JSON-RPC `-32700 Parse error`: PDF exceeds the plugin's 50 MB request cap (~35 MB PDF size) — Way 2 (`file`) has no such limit
- Connection failures: verify Zotero is running and MCP server is enabled
- Import failures: retry with one PDF first, then run batch import
- `error=collection not found`: create the collection manually in Zotero first

### Filing Failures (`file` — Way 2)
- Any failure → fall back to Way 3 (`push`) per the fallback chain
- "no existing item matched and no --metadata given": build a metadata JSON (see PDF Filing section) and retry once before falling back
- `summary=INCOMPLETE`: the verify step failed; check `verify_in_collection` / `verify_pdf_count` output and re-run with `--force` if a stale attachment exists

### Item Import Failures (`push` — Way 3)
- Way 3 is the last link in the chain; if it also fails, report the per-PDF failure to the user
- "Zotero not running": start the Zotero desktop app (only `--dry-run` works offline)
- "collection '...' not found": create the collection in Zotero first
- HTTP 409: item already saved — treated as success (duplicate-safe)
- "Target library is read-only": switch to a writable collection in Zotero

## Quick Reference: Common Workflows

### Load a PDF with automatic fallback (Way 1 → 2 → 3)
```bash
S="zotero-skill/scripts/zotero.mjs"; P=23120

# Way 1: direct import
node $S import --pdf "paper.pdf" --mcp-port $P \
# Way 2 (if Way 1 failed): file — needs --collection plus --doi and/or --metadata
|| node $S file --pdf "paper.pdf" --collection "My Collection" --doi "10.1234/example" --metadata metadata.json --mcp-port $P \
# Way 3 (if Way 2 failed): push JSON with pdfUrl (downloads + attaches)
|| node $S push --json paper.json --collection "My Collection"
```
Each non-zero exit (or `fail=` / `summary=INCOMPLETE` / `Failed:` output) triggers the next way. Verify afterwards with `find --doi` or `mcp-search`.

### Import and tag PDFs
```bash
# 1. Import a small PDF
node zotero-skill/scripts/zotero.mjs import --pdf "paper.pdf" --mcp-port 23120

# 2. Search for the item to get its key
node zotero-skill/scripts/zotero.mjs mcp-search --mcp-port 23120 --query "paper" --limit 5

# 3. Add tags to the item
node zotero-skill/scripts/zotero.mjs mcp-add-tags --mcp-port 23120 --item-key "ITEM_KEY" --tags "important,toread"
```

### File a publisher PDF into a collection
```bash
# 1. Check whether the item already exists (by DOI)
node zotero-skill/scripts/zotero.mjs find --doi "10.1234/example" --collection "My Collection" --mcp-port 23120

# 2. File the PDF (reuses the matched item, or creates the parent from metadata.json)
node zotero-skill/scripts/zotero.mjs file --pdf "paper.pdf" --collection "My Collection" --doi "10.1234/example" --metadata metadata.json --mcp-port 23120
```

### Find related papers
```bash
# 1. Search for a paper
node zotero-skill/scripts/zotero.mjs mcp-search --mcp-port 23120 --query "attention is all you need" --limit 1

# 2. Find semantically similar papers
node zotero-skill/scripts/zotero.mjs mcp-find-similar --mcp-port 23120 --item-key "ITEM_KEY" --limit 10
```

### Batch process folder with notes
```bash
# 1. Import all PDFs from folder
node zotero-skill/scripts/zotero.mjs import --dir "./papers" --recursive --mcp-port 23120

# 2. Create a note for a specific paper
node zotero-skill/scripts/zotero.mjs mcp-write-note --mcp-port 23120 --item-key "ITEM_KEY" --note "# Summary\n\nKey findings..."
```

### Push RIS exports from databases
```bash
# 1. Preview what would be created
node zotero-skill/scripts/zotero.mjs push --ris-file export.ris --dry-run

# 2. Push into an existing collection
node zotero-skill/scripts/zotero.mjs push --ris-file export.ris --collection "My Collection"
```
