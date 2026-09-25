#!/usr/bin/env node
/**
 * zotero_tool.ts — Zotero local import/check tool with MCP support (dsh / TypeScript edition).
 *
 * Zero-dependency: uses Node built-ins only (node:fs, node:path) and global fetch (Node >= 18).
 * Run directly (Node >= 22.6 with type stripping, or bun):
 *   node scripts/zotero_tool.ts mcp-health
 *   bun  scripts/zotero_tool.ts mcp-search --query "topic modeling"
 * Or compile once and run the JS:
 *   tsc scripts/zotero_tool.ts --outDir scripts --target es2022 --module nodenext
 *
 * Talks JSON-RPC 2.0 to the zotero-mcp plugin's HTTP endpoint (default port 23120),
 * which proxies to the Zotero desktop Local Connector (port 23119).
 *
 * Exit codes: 0 ok | 2 usage | 4 no PDFs found | 5 partial import failure
 *             11 doctor failure | 20 runtime error | 21 invalid input
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// =============================================================================
// Types
// =============================================================================

type ArgValue = string | boolean | number | string[];
type Args = Record<string, ArgValue | undefined>;

interface RpcError {
  code?: number;
  message?: string;
  data?: unknown;
}

interface RpcResponse {
  jsonrpc?: string;
  id?: number;
  result?: {
    content?: Array<{ text?: string }>;
    tools?: Array<{ name?: string }>;
    [key: string]: unknown;
  };
  error?: RpcError;
}

// =============================================================================
// Host detection (dsh edition)
// =============================================================================

/**
 * dsh runs bash on the user's machine, next to the Zotero desktop app, so the
 * default target is loopback. Container-style detection (/proc, hostname -I)
 * from the Python edition does not apply; an explicit env override and a
 * DOCKER_HOST tcp:// parse are kept for containerized deployments.
 */
function detectHost(): string {
  const envHost = process.env.HOST_IP || process.env.HOST;
  if (envHost && envHost.trim()) return envHost.trim();

  const dockerHost = process.env.DOCKER_HOST || "";
  const match = dockerHost.match(/tcp:\/\/([^:]+):/);
  if (match && match[1]) return match[1];

  return "127.0.0.1";
}

const HOST = detectHost();
const DEFAULT_MCP_PORT = Number(process.env.ZOTERO_MCP_PORT || "23120") || 23120;

// =============================================================================
// MCP Client (zotero-mcp integration)
// =============================================================================

class ZoteroMCPClient {
  port: number;
  timeout: number; // seconds
  host: string;
  baseUrl: string;

  constructor(opts: { port?: number; timeout?: number; host?: string } = {}) {
    this.port = opts.port ?? DEFAULT_MCP_PORT;
    this.timeout = opts.timeout ?? 30;
    this.host = opts.host ?? HOST;
    this.baseUrl = `http://${this.host}:${this.port}/mcp`;
  }

  private requestId(): number {
    return Date.now() % 1_000_000;
  }

  private async post(payload: unknown, timeoutSeconds = this.timeout): Promise<RpcResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    try {
      const res = await fetch(this.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      console.log(`debug=http_status=${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return (await res.json()) as RpcResponse;
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        throw new Error(`MCP server request timed out after ${timeoutSeconds}s`);
      }
      throw new Error(
        `Cannot connect to MCP server at ${this.baseUrl} (${err.message}). ` +
          "Ensure zotero-mcp plugin is installed and MCP server is enabled."
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Call an MCP tool via JSON-RPC tools/call and unwrap the content payload. */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    console.log(`debug=_call_tool_url=${this.baseUrl}`);
    console.log(`debug=_call_tool_name=${name}`);
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
    const content = (result as any).content;
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
  async ping(): Promise<boolean> {
    try {
      await this.post({ jsonrpc: "2.0", id: this.requestId(), method: "tools/list" }, 5);
      return true;
    } catch {
      return false;
    }
  }

  /** List available MCP tools (debugging). */
  async listAvailableTools(): Promise<Array<{ name?: string }> | { error: string }> {
    try {
      const r = await this.post({ jsonrpc: "2.0", id: this.requestId(), method: "tools/list" });
      return r.result?.tools ?? [];
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // ---- Search & Query Tools ----
  searchLibrary(query: string, mode = "title,creator,year,tags,fulltext", limit = 20): Promise<any> {
    return this.callTool("search_library", { q: query, mode, limit });
  }

  searchAnnotations(
    query: string,
    opts: { color?: string; tags?: string[]; limit?: number } = {}
  ): Promise<any> {
    const args: Record<string, unknown> = { q: query, limit: opts.limit ?? 20 };
    if (opts.color) args.color = opts.color;
    if (opts.tags) args.tags = opts.tags;
    return this.callTool("search_annotations", args);
  }

  searchFulltext(query: string, limit = 20): Promise<any> {
    return this.callTool("search_fulltext", { q: query, limit });
  }

  getItemDetails(itemKey: string): Promise<any> {
    return this.callTool("get_item_details", { itemKey });
  }

  getItemAbstract(itemKey: string, format = "text"): Promise<any> {
    return this.callTool("get_item_abstract", { itemKey, format });
  }

  getContent(itemKey: string, mode = "standard"): Promise<any> {
    return this.callTool("get_content", { itemKey, mode });
  }

  // ---- Collection Tools ----
  getCollections(limit = 1000): Promise<any> {
    return this.callTool("get_collections", { limit });
  }

  getCollectionDetails(collectionKey: string): Promise<any> {
    return this.callTool("get_collection_details", { collectionKey });
  }

  getCollectionItems(collectionKey: string, limit = 50): Promise<any> {
    return this.callTool("get_collection_items", { collectionKey, limit });
  }

  getSubcollections(collectionKey: string, recursive = false): Promise<any> {
    return this.callTool("get_subcollections", { collectionKey, recursive });
  }

  // ---- Semantic Search Tools ----
  semanticSearch(query: string, limit = 10): Promise<any> {
    return this.callTool("semantic_search", { query, limit });
  }

  findSimilar(itemKey: string, limit = 10): Promise<any> {
    return this.callTool("find_similar", { itemKey, limit });
  }

  semanticStatus(): Promise<any> {
    return this.callTool("semantic_status", {});
  }

  // ---- Full-text Database Tools ----
  fulltextDatabase(
    action: string,
    opts: { itemKey?: string; query?: string; limit?: number } = {}
  ): Promise<any> {
    const args: Record<string, unknown> = { action, limit: opts.limit ?? 20 };
    if (opts.itemKey) args.itemKey = opts.itemKey;
    if (opts.query) args.query = opts.query;
    return this.callTool("fulltext_database", args);
  }

  // ---- Write Operations ----
  writeNote(itemKey: string, note: string): Promise<any> {
    return this.callTool("write_note", { parentKey: itemKey, content: note, action: "create" });
  }

  writeTag(itemKey: string, tags: string[], operation = "add"): Promise<any> {
    return this.callTool("write_tag", { itemKey, tags, action: operation });
  }

  writeMetadata(itemKey: string, fields: Record<string, unknown>): Promise<any> {
    return this.callTool("write_metadata", { itemKey, fields });
  }

  writeItem(itemType: string, properties: Record<string, unknown> = {}): Promise<any> {
    return this.callTool("write_item", { action: "create", itemType, ...properties });
  }

  // ---- Local Connector (port 23119) health ----

  /**
   * Ping the Zotero Local Connector directly (no MCP proxy).
   * GET http://<host>:23119/connector/ping returns 200 "Zotero is running"
   * when the desktop app is up and "Allow other applications to communicate
   * with Zotero" is enabled. Never throws — returns a status object.
   */
  async connectorPingDirect(
    port = 23119,
    timeoutSeconds = 5
  ): Promise<{
    status: "healthy" | "unhealthy" | "unreachable";
    httpStatus?: number;
    body?: string;
    error?: string;
    source: string;
  }> {
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
      const err = e as Error;
      return {
        status: "unreachable",
        error: err.name === "AbortError" ? `timed out after ${timeoutSeconds}s` : err.message,
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
  async connectorHealth(port = 23119): Promise<any> {
    const direct = await this.connectorPingDirect(port);
    if (direct.status === "healthy") return direct;

    // Direct ping failed — try the MCP proxy before giving up.
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
   */
  async importPdf(pdfPath: string, collection?: string): Promise<any> {
    if (!existsSync(pdfPath)) {
      return { success: false, error: `PDF file not found: ${pdfPath}` };
    }
    let pdfContent: string;
    try {
      pdfContent = readFileSync(pdfPath).toString("base64");
    } catch (e) {
      return { success: false, error: `Failed to read PDF: ${(e as Error).message}` };
    }
    const args: Record<string, unknown> = {
      pdf_content: pdfContent,
      pdf_filename: basename(pdfPath),
    };
    if (collection) args.collection = collection;
    return this.callTool("import_pdf", args);
  }
}

// =============================================================================
// PDF gathering helpers
// =============================================================================

function listPdfFiles(dir: string, recursive: boolean): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
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

function normalizePickTokens(picks: string[] | undefined): string[] {
  if (!picks) return [];
  const out: string[] = [];
  for (const item of picks) {
    for (const p of item.split(",")) {
      if (p.trim()) out.push(p.trim());
    }
  }
  return out;
}

function pickFromDirectory(directory: string, pickTokens: string[], recursive: boolean): string[] {
  if (pickTokens.length === 0) return [];

  const allPdfs = listPdfFiles(directory, recursive).map((p) => resolve(p));
  const byAbs = new Set<string>(allPdfs);
  const byBase = new Map<string, string[]>();
  for (const p of allPdfs) {
    const key = basename(p).toLowerCase();
    const bucket = byBase.get(key);
    if (bucket) bucket.push(p);
    else byBase.set(key, [p]);
  }

  const selected: string[] = [];
  for (const token of pickTokens) {
    const t = token.replace(/^["']+|["']+$/g, "").trim();
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
    else if (matched.length > 1)
      throw new Error(`ambiguous pick token: ${token} (matched ${matched.length} files)`);
    else throw new Error(`pick file not found in dir: ${token}`);
  }
  return selected;
}

function gatherPdfs(
  pdfList: string[] | undefined,
  directory: string | undefined,
  recursive: boolean,
  pickTokens: string[] = []
): string[] {
  const files: string[] = [];
  if (pdfList) files.push(...pdfList);
  if (directory) {
    if (pickTokens.length > 0) files.push(...pickFromDirectory(directory, pickTokens, recursive));
    else files.push(...listPdfFiles(directory, recursive));
  }

  const seen = new Set<string>();
  const out: string[] = [];
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
const BOOLEAN_FLAGS = new Set(["recursive", "auto-install-deps"]);

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith("--")) throw new Error(`unexpected positional argument: ${tok}`);
    let key = tok.slice(2);
    let value: string | undefined;
    const eq = key.indexOf("=");
    if (eq >= 0) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    }
    if (!key) throw new Error("empty option name");

    if (value === undefined) {
      if (BOOLEAN_FLAGS.has(key)) value = "true";
      else {
        value = argv[++i];
        if (value === undefined) throw new Error(`missing value for --${key}`);
      }
    }

    if (REPEATABLE_FLAGS.has(key)) {
      const arr = (args[key] as string[]) ?? [];
      arr.push(value);
      args[key] = arr;
    } else if (NUMERIC_FLAGS.has(key)) {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`invalid numeric value for --${key}: ${value}`);
      args[key] = n;
    } else if (BOOLEAN_FLAGS.has(key)) {
      args[key] = value === "true";
    } else {
      args[key] = value;
    }
  }
  return args;
}

// ---- typed accessors ----

function req(args: Args, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || !v) {
    throw new UsageError(`missing required option --${key}`);
  }
  return v;
}

function opt(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

function numArg(args: Args, key: string, dflt: number): number {
  const v = args[key];
  return typeof v === "number" ? v : dflt;
}

function flag(args: Args, key: string): boolean {
  return args[key] === true;
}

function csvTags(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

class UsageError extends Error {}

function usage(): string {
  return [
    "Usage: node zotero_tool.ts <command> [options]",
    "",
    "Commands:",
    "  mcp-health              Check runtime + MCP server + Zotero connector health",
    "  mcp-import-pdf          Import PDFs (via --pdf repeatable or --dir, optional --pick, --collection)",
    "  mcp-search              Search library (title, creator, year, tags, fulltext)",
    "  mcp-search-annotations  Search annotations/highlights (--color, --tags)",
    "  mcp-search-fulltext     Full-text search",
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
    "Common options: --mcp-port (default $ZOTERO_MCP_PORT or 23120), --timeout seconds",
    "",
    "Exit codes: 0 ok | 2 usage | 4 no PDFs | 5 partial import failure",
    "            11 doctor failure | 20 runtime error | 21 invalid input",
  ].join("\n");
}

// =============================================================================
// Output helpers (keep the key=value line protocol of the Python edition)
// =============================================================================

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function clientFrom(args: Args, defaultTimeout = 30): ZoteroMCPClient {
  return new ZoteroMCPClient({
    port: numArg(args, "mcp-port", DEFAULT_MCP_PORT),
    timeout: numArg(args, "timeout", defaultTimeout),
  });
}

// =============================================================================
// Command handlers
// =============================================================================

async function cmdDoctor(args: Args): Promise<number> {
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
    console.log(`debug=tools_list_exception=${(e as Error).message}`);
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
    console.log(`zotero_connector=check_error error=${(e as Error).message}`);
    ok = false;
  }

  console.log(ok ? "doctor=ok" : "doctor=fail");
  return ok ? 0 : 11;
}

async function cmdImport(args: Args): Promise<number> {
  const pdfList = args.pdf as string[] | undefined;
  const dir = opt(args, "dir");
  const picks = normalizePickTokens(args.pick as string[] | undefined);

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
        console.log(
          `fail=${p} error=${(result && (result.message || result.error)) || "unknown error"}`
        );
        if (result && result.error) console.log(`debug=error_detail=${result.error}`);
        if (result && result.message) console.log(`debug=message_detail=${result.message}`);
      }
    } catch (e) {
      failCount += 1;
      console.log(`fail=${p} error=${(e as Error).message}`);
    }
  }

  console.log(`summary=ok:${okCount} fail:${failCount} total:${pdfs.length}`);
  return failCount === 0 ? 0 : 5;
}

async function cmdSearch(args: Args): Promise<number> {
  const client = clientFrom(args);
  const result = await client.searchLibrary(
    req(args, "query"),
    opt(args, "mode") ?? "title,creator,year,tags,fulltext",
    numArg(args, "limit", 20)
  );
  printJson(result);
  return 0;
}

async function cmdSearchAnnotations(args: Args): Promise<number> {
  const tags = opt(args, "tags");
  const client = clientFrom(args);
  const result = await client.searchAnnotations(req(args, "query"), {
    color: opt(args, "color"),
    tags: tags ? csvTags(tags) : undefined,
    limit: numArg(args, "limit", 20),
  });
  printJson(result);
  return 0;
}

async function cmdSearchFulltext(args: Args): Promise<number> {
  const client = clientFrom(args);
  const result = await client.searchFulltext(req(args, "query"), numArg(args, "limit", 20));
  printJson(result);
  return 0;
}

async function cmdItemDetails(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(await client.getItemDetails(req(args, "item-key")));
  return 0;
}

async function cmdItemAbstract(args: Args): Promise<number> {
  const format = opt(args, "format") ?? "text";
  if (!["text", "json"].includes(format)) {
    console.log(`error=invalid --format (expected text|json): ${format}`);
    return 2;
  }
  const client = clientFrom(args);
  printJson(await client.getItemAbstract(req(args, "item-key"), format));
  return 0;
}

async function cmdGetContent(args: Args): Promise<number> {
  const mode = opt(args, "mode") ?? "standard";
  if (!["minimal", "preview", "standard", "complete"].includes(mode)) {
    console.log(`error=invalid --mode (expected minimal|preview|standard|complete): ${mode}`);
    return 2;
  }
  const client = clientFrom(args);
  printJson(await client.getContent(req(args, "item-key"), mode));
  return 0;
}

async function cmdCollections(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(await client.getCollections(numArg(args, "limit", 1000)));
  return 0;
}

async function cmdCollectionDetails(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(await client.getCollectionDetails(req(args, "collection-key")));
  return 0;
}

async function cmdCollectionItems(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(
    await client.getCollectionItems(req(args, "collection-key"), numArg(args, "limit", 50))
  );
  return 0;
}

async function cmdSubcollections(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(await client.getSubcollections(req(args, "collection-key"), flag(args, "recursive")));
  return 0;
}

async function cmdSemanticSearch(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(await client.semanticSearch(req(args, "query"), numArg(args, "limit", 10)));
  return 0;
}

async function cmdFindSimilar(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(await client.findSimilar(req(args, "item-key"), numArg(args, "limit", 10)));
  return 0;
}

async function cmdSemanticStatus(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(await client.semanticStatus());
  return 0;
}

async function cmdFulltextDb(args: Args): Promise<number> {
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

async function cmdWriteNote(args: Args): Promise<number> {
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

async function cmdReadNote(args: Args): Promise<number> {
  const client = clientFrom(args);
  printJson(await client.getContent(req(args, "note-key"), "complete"));
  return 0;
}

function tagCommand(operation: string): (args: Args) => Promise<number> {
  return async (args: Args): Promise<number> => {
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

async function cmdUpdateMetadata(args: Args): Promise<number> {
  const fields: Record<string, unknown> = {};
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

async function cmdUpdateCreators(args: Args): Promise<number> {
  let creators: unknown;
  try {
    creators = JSON.parse(req(args, "creators"));
  } catch (e) {
    console.log(`error=invalid JSON for creators: ${(e as Error).message}`);
    return 21;
  }
  const client = clientFrom(args);
  printJson(await client.writeMetadata(req(args, "item-key"), { creators }));
  return 0;
}

async function cmdCreateItem(args: Args): Promise<number> {
  const properties: Record<string, unknown> = {};
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

async function cmdReparentPdf(args: Args): Promise<number> {
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
// Dispatch
// =============================================================================

const commands: Record<string, (args: Args) => Promise<number>> = {
  "mcp-health": cmdDoctor,
  "mcp-import-pdf": cmdImport,
  import: cmdImport, // alias kept for compatibility with older docs
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
};

async function main(): Promise<number> {
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

  let args: Args;
  try {
    args = parseArgs(argv.slice(1));
  } catch (e) {
    console.log(`error=${(e as Error).message}`);
    return 2;
  }

  try {
    return await handler(args);
  } catch (e) {
    if (e instanceof UsageError) {
      console.log(`error=${e.message}`);
      return 2;
    }
    console.log(`error=${(e as Error).message ?? e}`);
    return 20;
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
