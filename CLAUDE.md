# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zotero MCP is a Zotero 7 plugin that integrates Model Context Protocol (MCP) for AI assistants. It embeds an MCP server directly in the plugin, using Streamable HTTP for real-time bidirectional communication with AI clients like Claude Desktop, Cherry Studio, and Cursor.

**Architecture**: `AI Client (streamable HTTP) ↔ Zotero Plugin (integrated MCP server)`

## Commands

```bash
cd zotero-mcp-ext

npm install          # Install dependencies
npm run build        # Build plugin + TypeScript check
npm start            # Start dev server with auto-reload (zotero-plugin serve)
npm run lint:check   # Check formatting and linting
npm run lint:fix     # Fix formatting and linting issues
npm test             # Run tests
npm run release      # Create release (patch version)
npm run release:beta # Create beta release
```

## Key Architecture

### Entry Points
- **[src/index.ts](zotero-mcp-ext/src/index.ts)**: Plugin bootstrap - initializes the `addon` global and defines `ztoolkit`
- **[src/addon.ts](zotero-mcp-ext/src/addon.ts)**: Main Addon class holding plugin data, hooks, and APIs
- **[src/hooks.ts](zotero-mcp-ext/src/hooks.ts)**: Zotero lifecycle hooks (`onStartup`, `onShutdown`, `onMainWindowLoad`, etc.)

### MCP Server Stack
- **[src/modules/httpServer.ts](zotero-mcp-ext/src/modules/httpServer.ts)**: Mozilla nsIServerSocket-based HTTP server. Exports singleton `httpServer`. Handles `/mcp`, `/mcp/status`, `/capabilities`, `/ping` endpoints.
- **[src/modules/streamableMCPServer.ts](zotero-mcp-ext/src/modules/streamableMCPServer.ts)**: JSON-RPC 2.0 MCP protocol implementation. Tools include `search_library`, `search_annotations`, `get_content`, `get_collections`, `search_fulltext`, etc.

### Search & Content
- **[src/modules/searchEngine.ts](zotero-mcp-ext/src/modules/searchEngine.ts)**: Core library search using `Zotero.Search`. Supports full-text search in attachments/notes, tag filtering (any/all/none), relevance scoring, boolean queries, and mode-based result limits.
- **[src/modules/unifiedContentExtractor.ts](zotero-mcp-ext/src/modules/unifiedContentExtractor.ts)**: Extracts PDF text, notes, abstracts, webpage snapshots with mode-based content length control.
- **[src/modules/smartAnnotationExtractor.ts](zotero-mcp-ext/src/modules/smartAnnotationExtractor.ts)**: Processes PDF annotations/highlights with relevance scoring.

### Preferences & Settings
- **[src/modules/serverPreferences.ts](zotero-mcp-ext/src/modules/serverPreferences.ts)**: Manages MCP server preferences (enabled, port). Notifies observers on changes.
- **[src/modules/preferenceScript.ts](zotero-mcp-ext/src/modules/preferenceScript.ts)**: Registers preference panel scripts.

### Response Wrapping
All MCP tool responses pass through `applyGlobalAIInstructions()` which:
- Wraps responses in `{ data, metadata }` structure
- Adds `metadata.toolGuidance` with tool-specific instructions for AI clients
- Protects response data structure

## Build Output

- Build artifacts: `.scaffold/build/`
- Final plugin: `zotero-mcp-ext.xpi` (created by `zotero-plugin build`)
- Config: [zotero-ext.config.ts](zotero-mcp-ext/zotero-ext.config.ts)

## Development Notes

- The `httpServer` singleton is used throughout - imported from `httpServer.ts`
- Plugin exposes APIs via `addon.api` (e.g., `addon.api.startServer()`)
- Preferences prefix: `extensions.zotero.zotero-mcp-ext`
- Plugin ID: `zotero-mcp-ext@autoagent.my`
- Zotero global: `Zotero.ZoteroMCPExt`
