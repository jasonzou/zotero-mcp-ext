#!/usr/bin/env node
/**
 * zotero.mjs — the single Zotero helper for the dsh skill family.
 *
 * Replaces three older scripts:
 *   - zotero_tool.ts        (MCP commands, port 23120)
 *   - push_to_zotero.py     (item/RIS import via the Zotero Connector, port 23119)
 *   - <publisher>_zotero.mjs (PDF filing via write_item action="import")
 *
 * Zero dependencies — Node built-ins and global fetch only (Node >= 18).
 *
 * THREE TRANSPORTS
 * ----------------
 *   MCP        http://HOST:23120/mcp        JSON-RPC tools/call to the zotero-mcp plugin
 *   Connector  http://HOST:23119/connector  Zotero desktop Connector API (RIS/items/PDF)
 *   Local API  http://HOST:23119/api/...    Zotero 7 local API (authorized writes)
 *
 * WHY PDF FILING STILL EXISTS
 * ---------------------------
 * The plugin's `import_pdf` tool takes base64 over JSON-RPC. The plugin HTTP layer
 * (zotero-mcp-plugin/src/modules/httpServer.ts) caps the request read at
 * `maxRequestSize = 50 MB`, so a PDF larger than ~35 MB is rejected before it
 * reaches the tool and the server answers HTTP 400 with JSON-RPC error -32700
 * "Parse error". `file` (write_item action="import") avoids that entirely: it
 * reads a path on the Zotero host and sends a tiny request body. It also
 * dedupes by DOI and verifies the result, so it stays the recommended path for
 * publisher PDFs. Consequence: action="import" REQUIRES an existing parent
 * item, so the filing flow is always: resolve parent -> attach -> verify.
 *
 * Commands:
 *   MCP (port 23120)
 *     mcp-health, mcp-import-pdf (alias: import), mcp-search, mcp-search-annotations,
 *     mcp-search-fulltext, mcp-item-details, mcp-item-abstract, mcp-get-content,
 *     mcp-collections, mcp-collection-details, mcp-collection-items, mcp-subcollections,
 *     mcp-semantic-search, mcp-find-similar, mcp-semantic-status, mcp-fulltext-db,
 *     mcp-write-note, mcp-read-note, mcp-add-tags, mcp-remove-tags, mcp-replace-tags,
 *     mcp-update-metadata, mcp-update-creators, mcp-create-item, mcp-reparent-pdf
 *   Filing (MCP, never duplicates an item)
 *     health, collections, find --doi <doi> [--collection <name>]
 *     file --pdf <path> --collection <name> [--doi <doi>] [--metadata <json>]
 *          [--title <title>] [--force]
 *   Import (port 23119)
 *     push [--ris-file <path> | --ris-data <str> | --json <path> | <path> | stdin]
 *          [--collection <name>] [--dry-run] [--local-api]
 *     list-collections
 *
 * Exit codes: 0 ok | 1 failure | 2 usage | 3 not found | 4 no PDFs / MCP error
 *             5 partial import failure | 11 doctor failure | 20 runtime error
 *             21 invalid input
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

// =============================================================================
// Host detection
// =============================================================================

/**
 * dsh runs next to the Zotero desktop app, so the default target is loopback.
 * An explicit env override and a DOCKER_HOST tcp:// parse are kept for
 * containerized deployments.
 */
function detectHost() {
  const envHost = process.env.HOST_IP || process.env.HOST;
  if (envHost && envHost.trim()) return envHost.trim();

  const dockerHost = process.env.DOCKER_HOST || "";
  const match = dockerHost.match(/tcp:\/\/([^:]+):/);
  if (match && match[1]) return match[1];

  return "127.0.0.1";
}

const HOST = detectHost();
const DEFAULT_MCP_PORT = Number(process.env.ZOTERO_MCP_PORT || "23120") || 23120;
const ZOTERO_LOCAL = (process.env.ZOTERO_LOCAL || `http://${HOST}:23119`).replace(/\/+$/, "");
const CONNECTOR_BASE = `${ZOTERO_LOCAL}/connector`;
const LOCAL_API_BASE = `${ZOTERO_LOCAL}/api/users/0`;
const HTTP_TIMEOUT = 15; // seconds, matching the Zotero Connector extension

let verbose = false;
function log(msg) {
  if (verbose) console.error(`[debug] ${msg}`);
}

// =============================================================================
// MCP client (zotero-mcp plugin, port 23120)
// =============================================================================

class UsageError extends Error {}

class ZoteroMCPClient {
  constructor(opts = {}) {
    this.port = opts.port ?? DEFAULT_MCP_PORT;
    this.timeout = opts.timeout ?? 30;
    this.host = opts.host ?? HOST;
    this.baseUrl = `http://${this.host}:${this.port}/mcp`;
  }

  requestId() {
    return Date.now() % 1000000;
  }

  async post(payload, timeoutSeconds = this.timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    try {
      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      console.error(`debug=http_status=${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (e) {
      if (e.name === "AbortError") {
        throw new Error(`MCP server request timed out after ${timeoutSeconds}s`);
      }
      throw new Error(
        `Cannot connect to MCP server at ${this.baseUrl} (${e.message}). ` +
          "Ensure zotero-mcp plugin is installed and MCP server is enabled."
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Call an MCP tool via JSON-RPC tools/call and unwrap the content payload. */
  async callTool(name, args = {}) {
    console.error(`debug=_call_tool_url=${this.baseUrl}`);
    console.error(`debug=_call_tool_name=${name}`);
    const response = await this.post({
      jsonrpc: "2.0",
      id: this.requestId(),
      method: "tools/call",
      params: { name, arguments: args },
    });

    if (response.error) {
      throw new Error(`MCP error: ${JSON.stringify(response.error)}`);
    }

    const result = response.result ?? {};
    const content = result.content;
    if (Array.isArray(content) && content.length > 0) {
      const text = content[0]?.text ?? "";
      if (text) {
        try {
          return JSON.parse(text);
        } catch {
          return { text };
        }
      }
    }
    return result;
  }

  /** Check availability via tools/list (any 2xx counts as alive). */
  async ping() {
    try {
      await this.post({ jsonrpc: "2.0", id: this.requestId(), method: "tools/list" }, 5);
      return true;
    } catch {
      return false;
    }
  }

  /** List available MCP tools (debugging). */
  async listAvailableTools() {
    try {
      const r = await this.post({ jsonrpc: "2.0", id: this.requestId(), method: "tools/list" });
      return r.result?.tools ?? [];
    } catch (e) {
      return { error: e.message };
    }
  }

  // ---- Search & Query Tools ----
  searchLibrary(query, mode = "title,creator,year,tags,fulltext", limit = 20) {
    return this.callTool("search_library", { q: query, mode, limit });
  }

  searchAnnotations(query, opts = {}) {
    const args = { q: query, limit: opts.limit ?? 20 };
    if (opts.color) args.color = opts.color;
    if (opts.tags) args.tags = opts.tags;
    return this.callTool("search_annotations", args);
  }

  searchFulltext(query, limit = 20) {
    return this.callTool("search_fulltext", { q: query, limit });
  }

  getItemDetails(itemKey) {
    return this.callTool("get_item_details", { itemKey });
  }

  getItemAbstract(itemKey, format = "text") {
    return this.callTool("get_item_abstract", { itemKey, format });
  }

  getContent(itemKey, mode = "standard") {
    return this.callTool("get_content", { itemKey, mode });
  }

  // ---- Collection Tools ----
  getCollections(limit = 1000) {
    return this.callTool("get_collections", { limit });
  }

  getCollectionDetails(collectionKey) {
    return this.callTool("get_collection_details", { collectionKey });
  }

  getCollectionItems(collectionKey, limit = 50) {
    return this.callTool("get_collection_items", { collectionKey, limit });
  }

  getSubcollections(collectionKey, recursive = false) {
    return this.callTool("get_subcollections", { collectionKey, recursive });
  }

  // ---- Semantic Search Tools ----
  semanticSearch(query, limit = 10) {
    return this.callTool("semantic_search", { query, limit });
  }

  findSimilar(itemKey, limit = 10) {
    return this.callTool("find_similar", { itemKey, limit });
  }

  semanticStatus() {
    return this.callTool("semantic_status", {});
  }

  // ---- Full-text Database Tools ----
  fulltextDatabase(action, opts = {}) {
    const args = { action, limit: opts.limit ?? 20 };
    if (opts.itemKey) args.itemKey = opts.itemKey;
    if (opts.query) args.query = opts.query;
    return this.callTool("fulltext_database", args);
  }

  // ---- Write Operations ----
  writeNote(itemKey, note) {
    return this.callTool("write_note", { parentKey: itemKey, content: note, action: "create" });
  }

  writeTag(itemKey, tags, operation = "add") {
    return this.callTool("write_tag", { itemKey, tags, action: operation });
  }

  writeMetadata(itemKey, fields) {
    return this.callTool("write_metadata", { itemKey, fields });
  }

  writeItem(itemType, properties = {}) {
    return this.callTool("write_item", { action: "create", itemType, ...properties });
  }

  // ---- Local Connector health ----

  /**
   * Ping the Zotero Local Connector directly (no MCP proxy).
   * GET http://<host>:23119/connector/ping returns 200 "Zotero is running"
   * when the desktop app is up and "Allow other applications to communicate
   * with Zotero" is enabled. Never throws — returns a status object.
   */
  async connectorPingDirect(port = 23119, timeoutSeconds = 5) {
    const url = `http://${this.host}:${port}/connector/ping`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json, text/html" },
        signal: controller.signal,
      });
      const body = (await res.text()).slice(0, 120);
      if (res.ok) {
        return { status: "healthy", httpStatus: res.status, body, source: `direct ${url}` };
      }
      return { status: "unhealthy", httpStatus: res.status, body, source: `direct ${url}` };
    } catch (e) {
      return {
        status: "unreachable",
        error: e.name === "AbortError" ? `timed out after ${timeoutSeconds}s` : e.message,
        source: `direct ${url}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * connector_health — wrapped ping of the Local Connector on port 23119.
   * Fast path: direct ping (works whenever the tool runs next to Zotero, incl. dsh).
   * Fallback: the MCP server's connector_health proxy tool (for containerized
   * clients where 23119 is not directly reachable); absent on some plugin builds.
   */
  async connectorHealth(port = 23119) {
    const direct = await this.connectorPingDirect(port);
    if (direct.status === "healthy") return direct;

    try {
      const proxied = await this.callTool("connector_health", { port });
      if (proxied && typeof proxied === "object") {
        return { ...proxied, directError: direct.error ?? direct.status, fallback: "mcp-proxy" };
      }
    } catch {
      // Proxy tool unavailable (older plugin builds) — fall through to the direct result.
    }
    return direct;
  }

   /**
    * Import a PDF via the Zotero Local Connector (proxied through MCP):
    * read the file, base64-encode it, and hand it to the import_pdf tool.
    * NOTE: request bodies over ~50 MB are rejected by the plugin (PDFs up to
    * ~35 MB are fine). Prefer the `file` command for larger PDFs or when you
    * want DOI dedupe + verification.
    */
  async importPdf(pdfPath, collection) {
    if (!existsSync(pdfPath)) {
      return { success: false, error: `PDF file not found: ${pdfPath}` };
    }
    let pdfContent;
    try {
      pdfContent = readFileSync(pdfPath).toString("base64");
    } catch (e) {
      return { success: false, error: `Failed to read PDF: ${e.message}` };
    }
    const args = { pdf_content: pdfContent, pdf_filename: basename(pdfPath) };
    if (collection) args.collection = collection;
    return this.callTool("import_pdf", args);
  }
}

// =============================================================================
// Zotero Connector API (port 23119) — RIS / items / PDF attachments
// =============================================================================

async function connectorRequest(endpoint, data, timeoutSeconds = HTTP_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const res = await fetch(`${CONNECTOR_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Zotero-Connector-API-Version": "3",
      },
      body: JSON.stringify(data ?? {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { error: text };
      }
    }
    return { status: res.status, data: parsed, text };
  } catch (e) {
    return {
      status: 0,
      data: null,
      text: "",
      error: e.name === "AbortError" ? `Request timed out (${timeoutSeconds}s)` : e.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function connectorRunning() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${CONNECTOR_BASE}/ping`, {
      method: "GET",
      headers: { Accept: "application/json, text/html" },
      signal: controller.signal,
    });
    const text = await res.text();
    return res.ok && text.includes("Zotero");
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Deterministic 12-char sessionID from a content key: same content => same session. */
function makeSessionId(contentKey) {
  return createHash("md5").update(contentKey, "utf8").digest("hex").slice(0, 12);
}

/** Currently selected Zotero collection (connector view, includes target tree). */
async function getSelectedCollection() {
  const { status, data } = await connectorRequest("getSelectedCollection");
  if (status !== 200 || !data) return null;
  return data;
}

/** Push RIS data via /connector/import with a deterministic session. */
async function pushRis(risData) {
  if (!risData.trim()) return { success: false, message: "Empty RIS data." };

  const sessionId = makeSessionId(risData.trim());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT * 1000);
  try {
    const res = await fetch(`${CONNECTOR_BASE}/import?session=${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(risData),
      signal: controller.signal,
    });
    const body = await res.text();
    if (res.ok) {
      return { success: true, message: `Saved to Zotero (session: ${sessionId}). Response: ${body}` };
    }
    if (res.status === 409) {
      return { success: true, message: `Already saved, no duplicates added (session: ${sessionId})` };
    }
    return { success: false, message: `HTTP ${res.status}: ${body}` };
  } catch (e) {
    return {
      success: false,
      message:
        e.name === "AbortError"
          ? `Request timed out (${HTTP_TIMEOUT}s)`
          : `Cannot connect to Zotero. Is Zotero desktop running? Error: ${e.message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Download a PDF through the browser session's cookies. */
async function downloadPdf(pdfUrl, cookies = "", referer = "") {
  const headers = {
    Cookie: cookies,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/145.0.0.0",
  };
  if (referer) headers.Referer = referer;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(pdfUrl, { headers, signal: controller.signal });
    if (!res.ok) return { bytes: null, error: `HTTP ${res.status} ${res.statusText}` };
    const contentType = res.headers.get("content-type") || "application/pdf";
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 1024) {
      return {
        bytes: null,
        error: `PDF file too small (${bytes.length} bytes), may require authentication`,
      };
    }
    return { bytes, contentType };
  } catch (e) {
    return { bytes: null, error: e.name === "AbortError" ? "download timed out" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Upload a PDF binary to Zotero via /connector/saveAttachment (Zotero 7.x flow). */
async function saveAttachment(sessionId, itemId, pdfBytes, pdfUrl, contentType = "application/pdf", title = "Full Text PDF") {
  const metadata = JSON.stringify({
    id: `${itemId}_pdf`,
    parentItemID: itemId,
    title,
    url: pdfUrl,
    contentType,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${CONNECTOR_BASE}/saveAttachment?sessionID=${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "X-Metadata": metadata,
        "Content-Length": String(pdfBytes.length),
        "X-Zotero-Connector-API-Version": "3",
      },
      body: pdfBytes,
      signal: controller.signal,
    });
    if (res.ok) return { status: res.status, error: null };
    return { status: res.status, error: (await res.text()).slice(0, 300) };
  } catch (e) {
    return { status: 0, error: e.name === "AbortError" ? "upload timed out" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

// =============================================================================
// Zotero local API (Zotero 7 authorized writes)
// =============================================================================

let _serverId = null;
let _apiKey = process.env.ZOTERO_API_KEY || null;

async function localHttp(method, url, body = undefined, timeoutSeconds = 30) {
  const headers = { "Content-Type": "application/json" };
  if (_serverId) headers["Zotero-Server-ID"] = _serverId;
  if (_apiKey) headers["Zotero-API-Key"] = _apiKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const serverId = res.headers.get("zotero-server-id");
    if (serverId) _serverId = serverId;
    const text = await res.text();
    return { status: res.status, text, headers: res.headers };
  } catch {
    return { status: null, text: "", headers: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Zotero 7 local API: writes need a key from POST /api/local/authorize. */
async function authorizeLocal() {
  if (!_serverId) {
    const res = await localHttp("GET", `${LOCAL_API_BASE}/collections?limit=1`);
    _serverId = res.headers?.get("zotero-server-id") ?? null;
  }
  if (!_serverId) throw new Error("Zotero local server did not issue a server id");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${ZOTERO_LOCAL}/api/local/authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Zotero-Server-ID": _serverId },
      body: JSON.stringify({ appName: "dsh-zotero", appVersion: "1.0" }),
      signal: controller.signal,
    });
    const payload = await res.json();
    _apiKey = payload.key;
  } catch (e) {
    throw new Error(`Zotero local authorize failed: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!_apiKey) throw new Error("Zotero did not issue a local API key");
}

async function localListCollections() {
  const res = await localHttp("GET", `${LOCAL_API_BASE}/collections?limit=100`);
  if (res.status !== 200) throw new Error(`Failed to list collections (HTTP ${res.status})`);
  try {
    return JSON.parse(res.text || "[]");
  } catch {
    return [];
  }
}

async function localResolveCollectionKey(name) {
  const cols = await localListCollections();
  for (const coll of cols) {
    if (coll?.data?.name === name) return coll.data.key;
  }
  return null;
}

async function localPushItems(items) {
  await authorizeLocal();
  const wire = items.map((it) => {
    const out = {};
    for (const [k, v] of Object.entries(it)) if (!k.startsWith("_")) out[k] = v;
    return out;
  });
  const res = await localHttp("POST", `${LOCAL_API_BASE}/items`, wire);
  if (res.status === 200) {
    let resp = {};
    try {
      resp = JSON.parse(res.text || "{}");
    } catch {
      /* ignore */
    }
    const keys = Object.values(resp.successful ?? {})
      .map((v) => (v && typeof v === "object" ? v.key : null))
      .filter(Boolean);
    return { ok: true, message: keys.length ? `OK: Saved (keys: ${keys.join(", ")})` : "OK: Saved" };
  }
  if (res.status === 409) {
    let resp = {};
    try {
      resp = JSON.parse(res.text || "{}");
    } catch {
      /* ignore */
    }
    const keys = Object.values(resp.failed ?? {})
      .map((v) => (v && typeof v === "object" ? v.existingKey : null))
      .filter(Boolean);
    if (!keys.length) {
      const m = res.text.match(/"existingKey"\s*:\s*"([A-Z0-9]+)"/);
      if (m) keys.push(m[1]);
    }
    return {
      ok: true,
      message: "OK: Already saved" + (keys.length ? ` (existing key: ${keys[0]})` : ""),
    };
  }
  return { ok: false, message: `Error: Zotero returned HTTP ${res.status}: ${(res.text || "").slice(0, 500)}` };
}

// =============================================================================
// Item building (shared by every import path)
// =============================================================================

/**
 * Build a Zotero item from loosely-shaped paper data. Accepts the union of the
 * fields the publisher skills have always sent (IEEE/SD/PM/WoS).
 */
function buildZoteroItem(paper) {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

  const info = String(paper.info || "").toLowerCase();
  let itemType = paper.itemType;
  if (!itemType) {
    if (info.includes("conference")) itemType = "conferencePaper";
    else if (info.includes("book")) itemType = "book";
    else itemType = "journalArticle";
  }

  // WoS-style provenance fields land in `extra`.
  const extraBits = [];
  for (const [label, key] of [
    ["WoS", "accessionNumber"],
    ["WoS Core Citations", "citedCount"],
    ["All DB Citations", "alldbCited"],
    ["JIF", "jif"],
    ["JIF Year", "jifYear"],
    ["JCR Quartile", "jcrQuartile"],
    ["Research Areas", "researchAreas"],
    ["WoS Categories", "wosCategories"],
    ["Document Type", "docType"],
  ]) {
    const val = paper[key];
    if (val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && !val.length) && val !== 0) {
      extraBits.push(`${label}: ${val}`);
    }
  }
  if (paper.arnumber) extraBits.push(`arnumber: ${paper.arnumber}`);
  if (paper.articleType) extraBits.push(`articleType: ${paper.articleType}`);
  if (paper.pmid) extraBits.push(`PMID: ${paper.pmid}`);
  if (paper.pmcid) extraBits.push(`PMCID: ${paper.pmcid}`);
  if (paper.pubtype) {
    for (const t of Array.isArray(paper.pubtype) ? paper.pubtype : [paper.pubtype]) {
      if (t) extraBits.push(`Publication Type: ${t}`);
    }
  }

  // Creator shapes: pass-through Zotero creator objects win, then "Last, F."
  // strings, then plain single-field names.
  const creators = [];
  if (Array.isArray(paper.creators)) {
    creators.push(...paper.creators);
  } else {
    const rawAuthors = Array.isArray(paper.authors)
      ? paper.authors
      : typeof paper.authors === "string"
        ? paper.authors.split(";")
        : [];
    for (const raw of rawAuthors) {
      if (raw && typeof raw === "object") {
        creators.push(raw.creatorType ? raw : { creatorType: "author", ...raw });
        continue;
      }
      const part = String(raw).trim();
      if (!part) continue;
      if (part.includes(",")) {
        const [family, given] = part.split(",", 2).map((x) => x.trim());
        creators.push({ creatorType: "author", firstName: given, lastName: family });
      } else {
        creators.push({ creatorType: "author", name: part });
      }
    }
  }

  const tags = [];
  for (const kw of [...(paper.keywords || []), ...(paper.authorKeywords || []), ...(paper.keywordsPlus || [])]) {
    if (typeof kw === "string" && kw.trim()) tags.push({ tag: kw.trim() });
  }

  const doi = String(paper.doi || "");
  const item = {
    itemType,
    title: paper.title || "",
    creators,
    abstractNote: paper.abstract || "",
    date: String(paper.date || paper.year || paper.pubdate || ""),
    publicationTitle: paper.journal || paper.publication || paper.source || "",
    volume: String(paper.volume || ""),
    issue: String(paper.issue || ""),
    pages: String(paper.pages || ""),
    DOI: doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, ""),
    url: paper.url || (/^https?:\/\//.test(doi) ? doi : ""),
    ISSN: String(paper.issn || ""),
    language: String(paper.language || ""),
    extra: extraBits.join("; "),
    libraryCatalog: paper.libraryCatalog || inferCatalog(paper),
    accessDate: now,
    tags,
    attachments: [],
  };

  if (paper.journalAbbr) item.journalAbbreviation = String(paper.journalAbbr);
  if (itemType === "conferencePaper") item.conferenceName = paper.publication || "";
  return item;
}

/** Reproduce each publisher builder's original libraryCatalog value. */
function inferCatalog(paper) {
  if (paper.arnumber) return "IEEE Xplore";
  if (paper.pmid) return "PubMed";
  if (paper.accessionNumber) return "Web of Science";
  if (paper.articleType) return "ScienceDirect";
  return "Zotero";
}

/** Push structured items via the Connector API (optionally with PDF attachments). */
async function saveItems(items, uri = "", attachments = null, cookies = "") {
  const key = items.map((item) => item.title || "").sort().join("|");
  const sessionId = makeSessionId(key);

  items.forEach((item, i) => {
    if (!item.id) item.id = `dsh_${sessionId}_${i}`;
  });

  const { status, data } = await connectorRequest("saveItems", {
    sessionID: sessionId,
    uri,
    items,
  });

  let alreadySaved = false;
  let msg;
  if (status === 201) {
    msg = `Saved to Zotero (session: ${sessionId})`;
  } else if (status === 409) {
    alreadySaved = true;
    msg = `Already saved, no duplicates added (session: ${sessionId})`;
  } else if (status === 500) {
    if (String(JSON.stringify(data)).includes("libraryEditable")) {
      return { status: 500, message: "Target library is read-only. Switch to a writable collection in Zotero." };
    }
    return { status: 500, message: `Zotero internal error: ${data?.error ?? ""}` };
  } else if (status === 0) {
    return { status: 0, message: "Zotero is not running or connection refused" };
  } else {
    return { status, message: `Unknown error, HTTP ${status}` };
  }

  if (attachments && attachments.length && !alreadySaved) {
    const col = await getSelectedCollection();
    const filesEditable = col ? col.filesEditable !== false : true;
    if (!filesEditable) {
      msg += "\n  (Target collection does not support file attachments, skipping PDF)";
    } else {
      const results = [];
      for (const att of attachments) {
        const idx = att.itemIndex ?? 0;
        const pdfUrl = att.pdfUrl || "";
        if (!pdfUrl) continue;
        const itemId = (idx < items.length ? items[idx].id : items[0].id) || items[0].id;

        log(`downloading PDF: ${pdfUrl.slice(0, 80)}...`);
        const dl = await downloadPdf(pdfUrl, cookies, att.referer || "");
        if (!dl.bytes) {
          results.push(`  PDF download failed: ${dl.error}`);
          continue;
        }
        log(`uploading PDF to Zotero (${dl.bytes.length} bytes)...`);
        const up = await saveAttachment(
          sessionId,
          itemId,
          dl.bytes,
          pdfUrl,
          dl.contentType || "application/pdf",
          att.title || "Full Text PDF"
        );
        if (up.status === 201) {
          results.push(`  PDF attached: ${att.title || "Full Text PDF"} (${Math.floor(dl.bytes.length / 1024)}KB)`);
        } else {
          results.push(`  PDF upload failed: HTTP ${up.status} ${up.error || ""}`);
        }
      }
      if (results.length) msg += "\n" + results.join("\n");
    }
  }

  return { status: 201, message: msg };
}

/** Normalize loose JSON input into { items, attachments, cookies, uri }. */
function prepareJsonPush(paperData) {
  let papers;
  let prebuilt = null;

  if (Array.isArray(paperData)) papers = paperData;
  else if (paperData && typeof paperData === "object" && Array.isArray(paperData.items)) {
    prebuilt = { items: paperData.items, uri: paperData.uri || "" };
    papers = paperData.items;
  } else if (paperData && typeof paperData === "object") papers = [paperData];
  else return { error: "input must be a paper object, an array, or {'items': [...]}." };

  if (!papers.length) return { error: "no papers to push." };

  if (prebuilt) {
    return { items: prebuilt.items, attachments: [], cookies: "", uri: prebuilt.uri };
  }

  const items = [];
  for (const p of papers) {
    if (p.itemType) items.push(p);
    else if (p.title) items.push(buildZoteroItem(p));
  }
  if (!items.length) return { error: "No valid paper data found." };

  const attachments = [];
  let cookies = "";
  papers.forEach((p, i) => {
    if (p.pdfUrl) {
      attachments.push({
        itemIndex: i,
        pdfUrl: p.pdfUrl,
        title: p.pdfTitle || "Full Text PDF",
        referer: p.pdfReferer || "",
      });
    }
    if (p.cookies && !cookies) cookies = p.cookies;
  });

  return { items, attachments, cookies, uri: papers[0].url || "" };
}

// =============================================================================
// PDF gathering helpers (mcp-import-pdf)
// =============================================================================

function listPdfFiles(dir, recursive) {
  const out = [];
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (recursive) walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

function normalizePickTokens(picks) {
  if (!picks) return [];
  const out = [];
  for (const item of picks) {
    for (const p of String(item).split(",")) {
      if (p.trim()) out.push(p.trim());
    }
  }
  return out;
}

function pickFromDirectory(directory, pickTokens, recursive) {
  if (pickTokens.length === 0) return [];

  const allPdfs = listPdfFiles(directory, recursive).map((p) => resolve(p));
  const byAbs = new Set(allPdfs);
  const byBase = new Map();
  for (const p of allPdfs) {
    const key = basename(p).toLowerCase();
    const bucket = byBase.get(key);
    if (bucket) bucket.push(p);
    else byBase.set(key, [p]);
  }

  const selected = [];
  for (const token of pickTokens) {
    const t = String(token).replace(/^["']+|["']+$/g, "").trim();
    if (!t) continue;

    if (isAbsolute(t)) {
      const ap = resolve(t);
      if (byAbs.has(ap)) {
        selected.push(ap);
        continue;
      }
    }

    const ap2 = resolve(join(directory, t));
    if (byAbs.has(ap2)) {
      selected.push(ap2);
      continue;
    }

    const baseKey = basename(t).toLowerCase();
    const matched = byBase.get(baseKey) ?? [];
    if (matched.length === 1) selected.push(matched[0]);
    else if (matched.length > 1) throw new Error(`ambiguous pick token: ${token} (matched ${matched.length} files)`);
    else throw new Error(`pick file not found in dir: ${token}`);
  }
  return selected;
}

function gatherPdfs(pdfList, directory, recursive, pickTokens = []) {
  const files = [];
  if (pdfList) files.push(...pdfList);
  if (directory) {
    if (pickTokens.length > 0) files.push(...pickFromDirectory(directory, pickTokens, recursive));
    else files.push(...listPdfFiles(directory, recursive));
  }

  const seen = new Set();
  const out = [];
  for (const f of files) {
    const af = resolve(f);
    if (!seen.has(af)) {
      seen.add(af);
      out.push(af);
    }
  }
  return out;
}

// =============================================================================
// CLI argument parsing (zero-dependency)
// =============================================================================

const REPEATABLE_FLAGS = new Set(["pdf", "pick"]);
const NUMERIC_FLAGS = new Set(["mcp-port", "timeout", "limit"]);
const BOOLEAN_FLAGS = new Set([
  "recursive",
  "auto-install-deps",
  "force",
  "dry-run",
  "list",
  "list-collections",
  "local-api",
  "verbose",
  "help",
]);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === "-h" || tok === "--help") {
      args.help = true;
      continue;
    }
    if (tok === "-v" || tok === "--verbose") {
      args.verbose = true;
      verbose = true;
      continue;
    }
    if (!tok.startsWith("--")) {
      args._.push(tok);
      continue;
    }

    let key = tok.slice(2);
    let value;
    const eq = key.indexOf("=");
    if (eq >= 0) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    }
    if (!key) throw new UsageError("empty option name");

    if (value === undefined) {
      if (BOOLEAN_FLAGS.has(key)) value = "true";
      else {
        value = argv[++i];
        if (value === undefined) throw new UsageError(`missing value for --${key}`);
      }
    }

    if (REPEATABLE_FLAGS.has(key)) {
      const arr = Array.isArray(args[key]) ? args[key] : [];
      arr.push(value);
      args[key] = arr;
    } else if (NUMERIC_FLAGS.has(key)) {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new UsageError(`invalid numeric value for --${key}: ${value}`);
      args[key] = n;
    } else if (BOOLEAN_FLAGS.has(key)) {
      args[key] = value === "true" || value === true;
    } else {
      args[key] = value;
    }
  }
  return args;
}

// ---- typed accessors ----

function req(args, key) {
  const v = args[key];
  if (typeof v !== "string" || !v) throw new UsageError(`missing required option --${key}`);
  return v;
}

function opt(args, key) {
  const v = args[key];
  return typeof v === "string" && v ? v : undefined;
}

/** First value of a possibly repeatable flag. */
function one(args, key) {
  const v = args[key];
  if (Array.isArray(v)) return v[0];
  return typeof v === "string" ? v : undefined;
}

function numArg(args, key, dflt) {
  const v = args[key];
  return typeof v === "number" ? v : dflt;
}

function flag(args, key) {
  return args[key] === true;
}

function csvTags(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function clientFrom(args, defaultTimeout = 30) {
  return new ZoteroMCPClient({
    port: numArg(args, "mcp-port", DEFAULT_MCP_PORT),
    timeout: numArg(args, "timeout", defaultTimeout),
    host: opt(args, "host"),
  });
}

// =============================================================================
// Usage
// =============================================================================

function usage() {
  return [
    "Usage: node zotero.mjs <command> [options]",
    "",
    "MCP commands (zotero-mcp plugin, port 23120):",
    "  mcp-health              Check runtime + MCP server + Zotero connector health",
    "  mcp-import-pdf          Import PDFs (--pdf repeatable or --dir, optional --pick, --collection)",
    "  import                  Alias of mcp-import-pdf",
    "  mcp-search              Search library (--query, --mode, --limit)",
    "  mcp-search-annotations  Search annotations/highlights (--query, --color, --tags)",
    "  mcp-search-fulltext     Full-text search (--query)",
    "  mcp-item-details        Get item details (--item-key)",
    "  mcp-item-abstract       Get item abstract (--item-key, --format text|json)",
    "  mcp-get-content         Get content (--item-key, --mode minimal|preview|standard|complete)",
    "  mcp-collections         List collections",
    "  mcp-collection-details  Collection details (--collection-key)",
    "  mcp-collection-items    Items in collection (--collection-key)",
    "  mcp-subcollections      Subcollections (--collection-key, --recursive)",
    "  mcp-semantic-search     Semantic search (--query)",
    "  mcp-find-similar        Semantically similar items (--item-key)",
    "  mcp-semantic-status     Semantic index status",
    "  mcp-fulltext-db         Fulltext DB ops (--action list|search|get|stats)",
    "  mcp-write-note          Create note (--item-key, --note | --note-file)",
    "  mcp-read-note           Read note (--note-key)",
    "  mcp-add-tags            Add tags (--item-key, --tags a,b)",
    "  mcp-remove-tags         Remove tags (--item-key, --tags a,b)",
    "  mcp-replace-tags        Replace tags (--item-key, --tags a,b)",
    "  mcp-update-metadata     Update metadata (--item-key, --title/--abstract/--doi/--url/--date)",
    "  mcp-update-creators     Update creators (--item-key, --creators <JSON array>)",
    "  mcp-create-item         Create item (--item-type, --title/--url/--abstract/--doi)",
    "  mcp-reparent-pdf        Reparent PDF (--pdf-key, --parent-key)",
    "",
    "PDF filing commands (MCP; reuses an existing item, never creates a duplicate):",
    "  health                  MCP server reachable?",
    "  collections             List collections as <key>\\t<path>",
    "  find --doi <doi> [--collection <name>]",
    "  file --pdf <path> --collection <name> [--doi <doi>] [--metadata <json>]",
    "       [--title <attachment title>] [--force]",
    "",
    "Item import commands (Zotero Connector / local API, port 23119):",
    "  push --ris-file <path> | --ris-data <str> | --json <path> | <path> | (stdin)",
    "       [--collection <name>] [--dry-run] [--local-api] [--list]",
    "  list-collections        List collections as <key>\\t<name> (local API)",
    "",
    "Options: --host, --mcp-port (default $ZOTERO_MCP_PORT or 23120), --timeout seconds,",
    "         --verbose. Env: ZOTERO_MCP_HOST, ZOTERO_MCP_PORT, ZOTERO_LOCAL, ZOTERO_API_KEY.",
    "",
    "Exit codes: 0 ok | 1 failure | 2 usage | 3 not found | 4 no PDFs / MCP error",
    "            5 partial import failure | 11 doctor failure | 20 runtime error",
    "            21 invalid input",
  ].join("\n");
}

// =============================================================================
// MCP command handlers
// =============================================================================

async function cmdDoctor(args) {
  let ok = true;
  console.log(`node_executable=${process.execPath}`);
  console.log(`node_version=${process.version}`);

  const client = clientFrom(args);
  const port = client.port;

  if (await client.ping()) {
    console.log(`mcp_server_ping=ok port=${port}`);
  } else {
    console.log(`mcp_server_ping=fail port=${port}`);
    ok = false;
  }

  console.log("\n--- DEBUG: Available MCP Tools ---");
  try {
    const tools = await client.listAvailableTools();
    if (Array.isArray(tools)) {
      const names = tools.map((t) => t.name ?? "unknown");
      console.log(`debug=available_tools=${JSON.stringify(names)}`);
      console.log(`debug=connector_health_in_list=${names.includes("connector_health")}`);
      console.log(`debug=zotero_doctor_in_list=${names.includes("zotero_doctor")}`);
    } else {
      console.log(`debug=tools_list_error=${JSON.stringify(tools)}`);
    }
  } catch (e) {
    console.log(`debug=tools_list_exception=${e.message}`);
  }
  console.log("--- END DEBUG ---\n");

  try {
    const result = await client.connectorHealth();
    if (result && result.status === "healthy") {
      console.log("zotero_connector=ok");
    } else {
      const detail = result && result.error ? ` error=${result.error}` : "";
      console.log(`zotero_connector=fail status=${result && result.status}${detail}`);
      ok = false;
    }
  } catch (e) {
    console.log(`zotero_connector=check_error error=${e.message}`);
    ok = false;
  }

  console.log(ok ? "doctor=ok" : "doctor=fail");
  return ok ? 0 : 11;
}

async function cmdImport(args) {
  const pdfList = Array.isArray(args.pdf) ? args.pdf : undefined;
  const dir = opt(args, "dir");
  const picks = normalizePickTokens(args.pick);

  if (!pdfList && !dir) {
    console.log("error=for import, provide --pdf (one or more) or --dir");
    return 2;
  }
  if (pdfList && dir) {
    console.log("error=choose one input source: (--pdf ... repeated) OR --dir");
    return 2;
  }
  if (picks.length > 0 && !dir) {
    console.log("error=--pick only works with --dir");
    return 2;
  }

  const pdfs = gatherPdfs(pdfList, dir, flag(args, "recursive"), picks);
  if (pdfs.length === 0) {
    console.log("error=no PDF files found");
    return 4;
  }

  const client = clientFrom(args, 90);
  console.log(`debug=mcp_server=${client.baseUrl}`);
  console.log(`debug=pdfs_to_import=${pdfs.length}`);

  let okCount = 0;
  let failCount = 0;
  for (const p of pdfs) {
    console.log(`debug=importing=${p}`);
    try {
      const result = await client.importPdf(p, opt(args, "collection"));
      console.log(`debug=raw_result=${JSON.stringify(result, null, 2).slice(0, 500)}`);
      if (result && result.success) {
        okCount += 1;
        console.log(`ok=${p}`);
      } else {
        failCount += 1;
        console.log(`fail=${p} error=${(result && (result.message || result.error)) || "unknown error"}`);
        if (result && result.error) console.log(`debug=error_detail=${result.error}`);
        if (result && result.message) console.log(`debug=message_detail=${result.message}`);
      }
    } catch (e) {
      failCount += 1;
      console.log(`fail=${p} error=${e.message}`);
    }
  }

  console.log(`summary=ok:${okCount} fail:${failCount} total:${pdfs.length}`);
  return failCount === 0 ? 0 : 5;
}

async function cmdSearch(args) {
  const client = clientFrom(args);
  printJson(
    await client.searchLibrary(
      req(args, "query"),
      opt(args, "mode") ?? "title,creator,year,tags,fulltext",
      numArg(args, "limit", 20)
    )
  );
  return 0;
}

async function cmdSearchAnnotations(args) {
  const tags = opt(args, "tags");
  const client = clientFrom(args);
  printJson(
    await client.searchAnnotations(req(args, "query"), {
      color: opt(args, "color"),
      tags: tags ? csvTags(tags) : undefined,
      limit: numArg(args, "limit", 20),
    })
  );
  return 0;
}

async function cmdSearchFulltext(args) {
  const client = clientFrom(args);
  printJson(await client.searchFulltext(req(args, "query"), numArg(args, "limit", 20)));
  return 0;
}

async function cmdItemDetails(args) {
  const client = clientFrom(args);
  printJson(await client.getItemDetails(req(args, "item-key")));
  return 0;
}

async function cmdItemAbstract(args) {
  const format = opt(args, "format") ?? "text";
  if (!["text", "json"].includes(format)) {
    console.log(`error=invalid --format (expected text|json): ${format}`);
    return 2;
  }
  const client = clientFrom(args);
  printJson(await client.getItemAbstract(req(args, "item-key"), format));
  return 0;
}

async function cmdGetContent(args) {
  const mode = opt(args, "mode") ?? "standard";
  if (!["minimal", "preview", "standard", "complete"].includes(mode)) {
    console.log(`error=invalid --mode (expected minimal|preview|standard|complete): ${mode}`);
    return 2;
  }
  const client = clientFrom(args);
  printJson(await client.getContent(req(args, "item-key"), mode));
  return 0;
}

async function cmdCollections(args) {
  const client = clientFrom(args);
  printJson(await client.getCollections(numArg(args, "limit", 1000)));
  return 0;
}

async function cmdCollectionDetails(args) {
  const client = clientFrom(args);
  printJson(await client.getCollectionDetails(req(args, "collection-key")));
  return 0;
}

async function cmdCollectionItems(args) {
  const client = clientFrom(args);
  printJson(await client.getCollectionItems(req(args, "collection-key"), numArg(args, "limit", 50)));
  return 0;
}

async function cmdSubcollections(args) {
  const client = clientFrom(args);
  printJson(await client.getSubcollections(req(args, "collection-key"), flag(args, "recursive")));
  return 0;
}

async function cmdSemanticSearch(args) {
  const client = clientFrom(args);
  printJson(await client.semanticSearch(req(args, "query"), numArg(args, "limit", 10)));
  return 0;
}

async function cmdFindSimilar(args) {
  const client = clientFrom(args);
  printJson(await client.findSimilar(req(args, "item-key"), numArg(args, "limit", 10)));
  return 0;
}

async function cmdSemanticStatus(args) {
  const client = clientFrom(args);
  printJson(await client.semanticStatus());
  return 0;
}

async function cmdFulltextDb(args) {
  const action = req(args, "action");
  if (!["list", "search", "get", "stats"].includes(action)) {
    console.log(`error=invalid --action (expected list|search|get|stats): ${action}`);
    return 2;
  }
  const client = clientFrom(args);
  printJson(
    await client.fulltextDatabase(action, {
      itemKey: opt(args, "item-key"),
      query: opt(args, "query"),
      limit: numArg(args, "limit", 20),
    })
  );
  return 0;
}

async function cmdWriteNote(args) {
  let noteContent = opt(args, "note");
  const noteFile = opt(args, "note-file");
  if (noteFile) {
    if (!existsSync(noteFile)) {
      console.log(`error=note file not found: ${noteFile}`);
      return 21;
    }
    noteContent = readFileSync(noteFile, "utf-8");
  }
  if (!noteContent) {
    console.log("error=no note content provided (--note or --note-file required)");
    return 21;
  }
  const client = clientFrom(args);
  printJson(await client.writeNote(req(args, "item-key"), noteContent));
  return 0;
}

async function cmdReadNote(args) {
  const client = clientFrom(args);
  printJson(await client.getContent(req(args, "note-key"), "complete"));
  return 0;
}

function tagCommand(operation) {
  return async (args) => {
    const tags = csvTags(req(args, "tags"));
    if (tags.length === 0) {
      console.log("error=no tags provided");
      return 21;
    }
    const client = clientFrom(args);
    printJson(await client.writeTag(req(args, "item-key"), tags, operation));
    return 0;
  };
}

async function cmdUpdateMetadata(args) {
  const fields = {};
  const title = opt(args, "title");
  const abstract = opt(args, "abstract");
  const doi = opt(args, "doi");
  const url = opt(args, "url");
  const date = opt(args, "date");
  if (title) fields.title = title;
  if (abstract) fields.abstract = abstract;
  if (doi) fields.DOI = doi;
  if (url) fields.url = url;
  if (date) fields.date = date;

  if (Object.keys(fields).length === 0) {
    console.log("error=no metadata fields to update");
    return 21;
  }
  const client = clientFrom(args);
  printJson(await client.writeMetadata(req(args, "item-key"), fields));
  return 0;
}

async function cmdUpdateCreators(args) {
  let creators;
  try {
    creators = JSON.parse(req(args, "creators"));
  } catch (e) {
    console.log(`error=invalid JSON for creators: ${e.message}`);
    return 21;
  }
  const client = clientFrom(args);
  printJson(await client.writeMetadata(req(args, "item-key"), { creators }));
  return 0;
}

async function cmdCreateItem(args) {
  const properties = {};
  const title = opt(args, "title");
  const url = opt(args, "url");
  const abstract = opt(args, "abstract");
  const doi = opt(args, "doi");
  if (title) properties.title = title;
  if (url) properties.url = url;
  if (abstract) properties.abstract = abstract;
  if (doi) properties.DOI = doi;
  const client = clientFrom(args);
  printJson(await client.writeItem(req(args, "item-type"), properties));
  return 0;
}

async function cmdReparentPdf(args) {
  const client = clientFrom(args);
  printJson(
    await client.writeItem("attachment", {
      itemKey: req(args, "pdf-key"),
      parentItem: req(args, "parent-key"),
    })
  );
  return 0;
}

// =============================================================================
// PDF filing handlers (MCP; resolve-or-create parent, then attach)
// =============================================================================

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.items)) return v.items;
  if (v && Array.isArray(v.collections)) return v.collections;
  if (v && Array.isArray(v.results)) return v.results;
  return [];
}

function unwrap(v) {
  return v && typeof v === "object" && v.data && typeof v.data === "object" ? v.data : v;
}

function attachmentsOf(item) {
  const arr = item && Array.isArray(item.attachments) ? item.attachments : [];
  return arr.filter((a) => a && typeof a === "object");
}

function isPdf(att) {
  const ct = String(att.contentType || "").toLowerCase();
  const fn = String(att.filename || att.path || att.title || "").toLowerCase();
  return ct === "application/pdf" || fn.endsWith(".pdf");
}

const normDoi = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "");

async function mcpGetCollections(client) {
  return asArray(await client.callTool("get_collections", {})).filter(
    (c) => c && typeof c.name === "string"
  );
}

async function mcpGetCollectionItems(client, key) {
  return asArray(await client.callTool("get_collection_items", { collectionKey: key })).filter(
    (i) => i && i.key
  );
}

async function mcpGetDetails(client, key) {
  const d = unwrap(await client.callTool("get_item_details", { itemKey: key }));
  return d && typeof d === "object" ? d : null;
}

async function resolveCollection(client, name) {
  const cols = await mcpGetCollections(client);
  const want = name.trim().toLowerCase();
  const exact = cols.filter((c) => c.name.toLowerCase() === want);
  const cands = exact.length ? exact : cols.filter((c) => c.name.toLowerCase().includes(want));
  if (!cands.length) {
    throw Object.assign(
      new Error(
        `collection "${name}" not found. Existing: ${cols.map((c) => c.name).join(", ") || "(none)"}`
      ),
      { code: 3 }
    );
  }
  if (cands.length > 1 && !exact.length) {
    throw Object.assign(
      new Error(`collection "${name}" is ambiguous: ${cands.map((c) => c.name).join(", ")}`),
      { code: 3 }
    );
  }
  return cands[0];
}

/**
 * Resolve a DOI to a library item.
 * 1. the target collection (its items carry DOI directly)
 * 2. a library search, each candidate confirmed through get_item_details
 */
async function resolveDoi(client, doi, collectionKey) {
  const want = normDoi(doi);

  if (collectionKey) {
    const inCol = await mcpGetCollectionItems(client, collectionKey);
    const hit = inCol.find((i) => normDoi(i.DOI) === want);
    if (hit) return { item: hit, matched: "collection-doi" };
  }

  const results = asArray(
    await client.callTool("search_library", { q: doi.trim(), mode: "standard" })
  ).filter((r) => r && r.key);
  if (!results.length) {
    const alt = asArray(
      await client.callTool("search_library", { q: doi.trim(), mode: "minimal" })
    ).filter((r) => r && r.key);
    results.push(...alt);
  }
  for (const cand of results) {
    const det = await mcpGetDetails(client, cand.key);
    if (det && normDoi(det.DOI) === want) return { item: det, matched: "library-doi" };
  }
  return { item: null, matched: null, candidates: results.slice(0, 8) };
}

async function cmdFilingHealth(args) {
  const client = clientFrom(args, 60);
  await client.callTool("get_libraries", {});
  console.log(`mcp_server=ok url=${client.baseUrl}`);
  return 0;
}

async function cmdFilingCollections(args) {
  const client = clientFrom(args, 60);
  for (const c of await mcpGetCollections(client)) console.log(`${c.key}\t${c.path || c.name}`);
  return 0;
}

async function cmdFind(args) {
  const doi = opt(args, "doi");
  if (!doi) throw Object.assign(new UsageError("--doi is required"), { code: 2 });

  const client = clientFrom(args, 60);
  let col = null;
  if (opt(args, "collection")) {
    col = await resolveCollection(client, opt(args, "collection"));
    console.log(
      `collection=${col.name} key=${col.key} items=${(await mcpGetCollectionItems(client, col.key)).length}`
    );
  }

  const { item, matched, candidates } = await resolveDoi(client, doi, col?.key);
  if (!item) {
    console.log(`match=none doi=${doi}`);
    if (candidates?.length) {
      console.log("candidates (unconfirmed):");
      for (const c of candidates) console.log(`  ${c.key}\t${c.title || ""}`);
    }
    return 3;
  }

  const pdfs = attachmentsOf(item).filter(isPdf);
  console.log(`match=${matched} key=${item.key}`);
  console.log(`title=${item.title || ""}`);
  console.log(`doi=${item.DOI || ""} date=${item.date || ""} type=${item.itemType || ""}`);
  console.log(`pdf_attachments=${pdfs.length}`);
  for (const p of pdfs) {
    console.log(`  ${p.key}\t${p.size ?? "?"}\t${p.contentType || "?"}\t${p.title || p.filename || ""}`);
  }
  return 0;
}

async function cmdFile(args) {
  const pdfArg = one(args, "pdf") ?? opt(args, "pdf");
  const collectionName = opt(args, "collection");
  if (!pdfArg) throw Object.assign(new UsageError("--pdf is required"), { code: 2 });
  if (!collectionName) throw Object.assign(new UsageError("--collection is required"), { code: 2 });

  const pdfPath = resolve(pdfArg);
  if (!existsSync(pdfPath)) {
    throw Object.assign(new Error(`PDF not found: ${pdfPath}`), { code: 2 });
  }
  const pdfBytes = readFileSync(pdfPath).length;

  const client = clientFrom(args, 120);
  const col = await resolveCollection(client, collectionName);
  console.log(`pdf=${pdfPath}`);
  console.log(`pdf_bytes=${pdfBytes}`);
  console.log(`collection=${col.name} key=${col.key}`);

  // 1. Reuse an existing item for this DOI (never create a duplicate).
  let parentKey = null;
  const doi = opt(args, "doi");
  if (doi) {
    const { item, matched } = await resolveDoi(client, doi, col.key);
    if (item) {
      parentKey = item.key;
      console.log(`reused_item=${parentKey} (${matched}) title=${item.title || ""}`);
    } else {
      console.log(`existing_item=none doi=${doi}`);
    }
  } else {
    console.log("existing_item=skipped (no --doi given)");
  }

  // 2. Otherwise create the parent from --metadata.
  if (!parentKey) {
    const metadataPath = opt(args, "metadata");
    if (!metadataPath) {
      throw Object.assign(
        new Error(
          "no existing item matched and no --metadata given. Provide a metadata JSON file " +
            "(see SKILL.md) so a proper parent item can be created, or attach to an item manually."
        ),
        { code: 3 }
      );
    }
    const meta = JSON.parse(readFileSync(resolve(metadataPath), "utf8"));
    const created = unwrap(
      await client.callTool("write_item", {
        action: "create",
        itemType: meta.itemType || "journalArticle",
        fields: meta.fields || {},
        creators: meta.creators || [],
        tags: meta.tags || [],
      })
    );
    parentKey = created?.itemKey || created?.key;
    if (!parentKey) {
      throw Object.assign(
        new Error(`create returned no item key: ${JSON.stringify(created).slice(0, 400)}`),
        { code: 4 }
      );
    }
    console.log(`created_item=${parentKey}`);
  }

  // 3. Attach the PDF unless the parent already has one (unless --force).
  const before = attachmentsOf(await mcpGetDetails(client, parentKey)).filter(isPdf);
  let attachmentKey = before[0]?.key || null;
  if (before.length && !flag(args, "force")) {
    console.log(`attachment=existing key=${attachmentKey} (skipped import; use --force to add another)`);
  } else {
    const imported = unwrap(
      await client.callTool("write_item", {
        action: "import",
        filePath: pdfPath,
        parentItemKey: parentKey,
        title: opt(args, "title") || "Full Text PDF",
      })
    );
    if (!imported?.attachmentKey) {
      throw Object.assign(
        new Error(`import failed: ${JSON.stringify(imported).slice(0, 400)}`),
        { code: 4 }
      );
    }
    attachmentKey = imported.attachmentKey;
    console.log(`attachment=imported key=${attachmentKey}`);
  }

  // 4. Ensure the parent is in the target collection.
  try {
    await client.callTool("add_items_to_collection", { collectionKey: col.key, itemKeys: [parentKey] });
    console.log(`collection_add=ok key=${col.key}`);
  } catch (e) {
    console.log(`collection_add=warn ${String(e.message).slice(0, 200)}`);
  }

  // 5. Verify from the collection itself, not from the write response.
  const present = (await mcpGetCollectionItems(client, col.key)).find((i) => i.key === parentKey);
  const pdfs = attachmentsOf(await mcpGetDetails(client, parentKey)).filter(isPdf);
  const ours = pdfs.find((p) => p.key === attachmentKey) || pdfs[0];

  console.log(`verify_in_collection=${present ? "yes" : "NO"}`);
  console.log(`verify_pdf_count=${pdfs.length}`);
  if (ours) {
    console.log(
      `verify_pdf=${ours.key} type=${ours.contentType || "?"} bytes=${ours.size ?? "?"} fulltext=${ours.hasFulltext ?? "?"}`
    );
    console.log(`verify_path=${ours.path || ""}`);
  }

  const ok = Boolean(present) && pdfs.length > 0 && (!ours || !ours.size || ours.size === pdfBytes);
  console.log(
    `summary=${ok ? "ok" : "INCOMPLETE"} parent=${parentKey} attachment=${attachmentKey} collection=${col.key}`
  );
  return ok ? 0 : 4;
}

// =============================================================================
// Import handlers (Connector / local API, port 23119)
// =============================================================================

async function cmdListCollections(args) {
  if (!(await connectorRunning())) {
    console.error("Error: Zotero not running (connector on 127.0.0.1:23119).");
    return 2;
  }
  for (const coll of await localListCollections()) {
    const data = coll.data ?? {};
    console.log(`${data.key}\t${data.name}`);
  }
  return 0;
}

/**
 * push — import RIS or structured items into Zotero.
 *
 * RIS goes through the Connector (/connector/import). Structured JSON goes
 * through the Connector (/connector/saveItems + saveAttachment) by default, or
 * the Zotero 7 local API when --local-api is given.
 *
 * Input: --ris-file, --ris-data, --json <path>, a positional <path>, or stdin.
 */
async function cmdPush(args) {
  const dryRun = flag(args, "dry-run");
  const listMode = flag(args, "list");
  const collectionName = opt(args, "collection");

  if (flag(args, "list-collections")) return cmdListCollections(args);

  // --dry-run works offline; every other mode needs the desktop app.
  const running = await connectorRunning();
  if (!running && !dryRun) {
    console.error("Error: Zotero not running — start the Zotero desktop app first (Local API on 127.0.0.1:23119).");
    return 2;
  }

  if (listMode) {
    const col = await getSelectedCollection();
    if (col) {
      console.log(`Current collection: ${col.name ?? "?"} (ID: ${col.id ?? "?"})`);
      console.log(`Library: ${col.libraryName ?? "?"}`);
      for (const t of col.targets ?? []) {
        const indent = "  ".repeat(t.level ?? 0);
        console.log(`  ${indent}${t.name} (ID: ${t.id})`);
      }
    }
    return 0;
  }

  const risFile = opt(args, "ris-file");
  const risData = opt(args, "ris-data");
  const jsonPath = opt(args, "json") ?? args._[0];

  const sourceCount = [risFile, risData, jsonPath].filter(Boolean).length;
  if (sourceCount > 1) {
    console.log("error=choose one input source: --ris-file, --ris-data, or --json/<path>");
    return 2;
  }
  if (sourceCount === 0 && process.stdin.isTTY) {
    console.log("error=provide --ris-file, --ris-data, --json <path>, a positional <path>, or JSON on stdin");
    return 2;
  }

  // Resolve the target collection once (local API lookup works for both backends).
  let collectionKey = null;
  if (collectionName) {
    try {
      collectionKey = await localResolveCollectionKey(collectionName);
    } catch (e) {
      console.error(`Error: could not look up collections: ${e.message}`);
      return 1;
    }
    if (!collectionKey) {
      console.error(`Error: collection '${collectionName}' not found.`);
      return 1;
    }
  }

  // ---- RIS path ----
  if (risFile || risData) {
    let data = risData;
    if (risFile) {
      if (!existsSync(risFile)) {
        console.error(`Error: RIS file not found: ${risFile}`);
        return 1;
      }
      data = readFileSync(risFile, "utf-8");
    }
    if (dryRun) {
      console.log("DRY-RUN RIS payload:");
      console.log(data);
      return 0;
    }
    const result = await pushRis(data);
    console.log(JSON.stringify(result, null, 2));
    return result.success ? 0 : 1;
  }

  // ---- JSON path ----
  let raw;
  try {
    if (jsonPath) {
      if (!existsSync(jsonPath)) {
        console.error(`Error: JSON file not found: ${jsonPath}`);
        return 1;
      }
      raw = readFileSync(jsonPath, "utf-8");
    } else if (process.stdin.isTTY) {
      console.error("error=no JSON input (pass --json <path>, a positional <path>, or pipe JSON on stdin)");
      return 2;
    } else {
      raw = readFileSync(0, "utf-8");
    }
  } catch (e) {
    console.error(`Error reading JSON input: ${e.message}`);
    return 1;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading JSON input: ${e.message}`);
    return 1;
  }

  const prepared = prepareJsonPush(parsed);
  if (prepared.error) {
    console.error(`Error: ${prepared.error}`);
    return 1;
  }
  const { items, attachments, cookies, uri } = prepared;

  if (collectionKey) {
    for (const it of items) it.collections = [collectionKey];
  }

  if (dryRun) {
    for (const it of items) console.log("DRY-RUN item:", JSON.stringify(it));
    return 0;
  }

  const col = await getSelectedCollection();
  if (col) console.log(`Zotero collection: ${col.name ?? "?"}`);

  if (flag(args, "local-api")) {
    try {
      const res = await localPushItems(items);
      if (res.ok) {
        console.log(`Success: ${res.message} (${items.length} items)`);
        return 0;
      }
      console.error(res.message);
      return 1;
    } catch (e) {
      console.error(`Error: ${e.message}`);
      return 1;
    }
  }

  const result = await saveItems(items, uri, attachments, cookies);
  if (result.status === 201) {
    console.log(`Success: ${result.message} (${items.length} items)`);
    for (const item of items) console.log(`  - ${item.title || "?"}`);
    return 0;
  }
  console.error(`Failed: ${result.message}`);
  return 1;
}

// =============================================================================
// Dispatch
// =============================================================================

const commands = {
  // MCP
  "mcp-health": cmdDoctor,
  "mcp-import-pdf": cmdImport,
  import: cmdImport, // compatibility alias
  "mcp-search": cmdSearch,
  "mcp-search-annotations": cmdSearchAnnotations,
  "mcp-search-fulltext": cmdSearchFulltext,
  "mcp-item-details": cmdItemDetails,
  "mcp-item-abstract": cmdItemAbstract,
  "mcp-get-content": cmdGetContent,
  "mcp-collections": cmdCollections,
  "mcp-collection-details": cmdCollectionDetails,
  "mcp-collection-items": cmdCollectionItems,
  "mcp-subcollections": cmdSubcollections,
  "mcp-semantic-search": cmdSemanticSearch,
  "mcp-find-similar": cmdFindSimilar,
  "mcp-semantic-status": cmdSemanticStatus,
  "mcp-fulltext-db": cmdFulltextDb,
  "mcp-write-note": cmdWriteNote,
  "mcp-read-note": cmdReadNote,
  "mcp-add-tags": tagCommand("add"),
  "mcp-remove-tags": tagCommand("remove"),
  "mcp-replace-tags": tagCommand("replace"),
  "mcp-update-metadata": cmdUpdateMetadata,
  "mcp-update-creators": cmdUpdateCreators,
  "mcp-create-item": cmdCreateItem,
  "mcp-reparent-pdf": cmdReparentPdf,
  // PDF filing
  health: cmdFilingHealth,
  collections: cmdFilingCollections,
  find: cmdFind,
  file: cmdFile,
  // Item import
  push: cmdPush,
  "list-collections": cmdListCollections,
};

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    console.log(usage());
    return argv.length === 0 ? 2 : 0;
  }

  const handler = commands[argv[0]];
  if (!handler) {
    console.log(`error=unknown command: ${argv[0]}`);
    console.log(usage());
    return 2;
  }

  let args;
  try {
    args = parseArgs(argv.slice(1));
  } catch (e) {
    console.log(`error=${e.message}`);
    return 2;
  }

  try {
    return await handler(args);
  } catch (e) {
    if (e instanceof UsageError) {
      console.log(`error=${e.message}`);
      return e.code ?? 2;
    }
    console.error(`ERROR: ${e.message ?? e}`);
    return e.code ?? 20;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`error=${e}`);
      process.exit(20);
    });
}
