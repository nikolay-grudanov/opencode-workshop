# Architecture

Raindrop Workshop is a local-first tracing and debugging surface for AI agents. A single Bun process runs the daemon (`src/index.ts` → `src/server.ts`) that ingests OpenTelemetry-shaped spans from agent SDKs via the `raindrop` SDK, persists them in a local SQLite database, and streams updates over a WebSocket to a React SPA. A sidepanel assistant can read the same traces back through MCP tools and through the in-process HTTP API.

This document maps the source tree (`src/`), traces a span end-to-end, and explains which directories are upstream-owned by [`raindrop-ai/workshop`](https://github.com/raindrop-ai/workshop) versus fork-only.

## Module map of `src/`

Every top-level module with: path, responsibility, key exports, and ownership tag. Ownership legend:

- **upstream** — owned by `raindrop-ai/workshop`. Edits require an explicit override from the user because future rebases will conflict.
- **fork-only** — does not exist upstream; safe to edit freely.
- **fork-modified** — exists upstream but has been intentionally modified in this fork. Edit carefully; rebases will need manual resolution.

### CLI entry & daemon

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/index.ts` (872 LOC) | CLI entry. Dispatches `raindrop workshop <verb>`, `setup`, `login`, `cloud`, `replay`, `update`, `uninstall`. Daemon launcher. | `main()`, `ensureDaemonRunning()` (`src/index.ts:153-211`) | upstream |
| `src/server.ts` (2550 LOC) | HTTP + WebSocket daemon. Mounts Express routes, `ws` server, replay engine, demo chat. | `createServer(port)` (`src/server.ts:410-2316`) | upstream |
| `src/db.ts` (1440 LOC) | Drizzle-over-`bun:sqlite` data layer; resolves DB path, runs migrations, exposes per-table query helpers. | `openDb()`, all `runs/spans/annotations/...` queries | upstream |
| `src/viewing-registry.ts` | Tracks which run/span each WS client is currently viewing. | `createViewingRegistry()` | upstream |
| `src/local-origin-guard.ts` | Loopback-only guard for browser-side endpoints. | `localOriginGuard` | upstream |
| `src/local-access.ts` | Local-access helpers (loopback detection, etc.). | helpers | upstream |
| `src/port-check.ts` | Port availability / next-free-port helpers. | `findFreePort()`-style helpers | upstream |
| `src/open-browser.ts` | Opens the default browser on first run. | `openBrowser()` | upstream |
| `src/version.ts` | Version constant (`VERSION`). | `VERSION` | upstream |
| `src/update.ts` | Self-update flow (downloads new binary from manifest). | update flow | upstream |
| `src/uninstall.ts` | Self-uninstall flow. | uninstall flow | upstream |
| `src/ids.ts` | ID generation / formatting helpers. | id helpers | upstream |
| `src/secret-store.ts` | Secret store wrapper (API keys etc.). | secret store | upstream |
| `src/workshop-startup.ts` | First-run orchestration, port selection, browser launch. | startup helpers | upstream |
| `src/drip.ts` | Drip campaign (onboarding nudges). | drip state | upstream |

### Ingest / OTLP pipeline

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/parse.ts` (242 LOC) | OTLP ingest body → typed `ParsedSpan`. Infers `span_type`, maps status codes. | `parseOtlpRequest(body)` (`src/parse.ts:124-242`), `inferSpanType()` (`:35-69`) | upstream |
| `src/otlp-protobuf.ts` (178 LOC) | Protobuf OTLP decoder (binary `application/x-protobuf` requests). | `decodeOtlpProtobuf(buf)` (`src/otlp-protobuf.ts:158-178`) | upstream |
| `src/spans/normalize.ts` (95 LOC) | Adapter dispatcher. Picks the right SDK adapter and returns a `NormalizedSpan`. | `normalizeSpan()` (`src/spans/normalize.ts:42-48`), `ADAPTERS` (`:32-40`) | upstream |
| `src/spans/normalized.ts` | Typed view (`NormalizedSpan`) returned by normalize. | `NormalizedSpan`, `emptyNormalized()` | upstream |
| `src/spans/adapters/types.ts` | `AdapterInput` / `AdapterMatch` contracts shared by all adapters. | `AdapterInput`, `AdapterMatch` | upstream |
| `src/spans/adapters/helpers.ts` | Shared adapter utilities (attribute extraction, JSON-coalesce). | helpers | upstream |
| `src/spans/adapters/ai-sdk.ts` | Adapter for Vercel AI SDK (`ai.streamText`, `ai.toolCall`, …). | adapter | upstream |
| `src/spans/adapters/claude-agent-sdk.ts` | Adapter for Anthropic Claude Agent SDK. | adapter | upstream |
| `src/spans/adapters/livekit.ts` | Adapter for LiveKit agents. | adapter | upstream |
| `src/spans/adapters/traceloop.ts` | Adapter for Traceloop (`traceloop.span.kind`). | adapter | upstream |
| `src/payload-slice.ts` | Server-side payload slicing for `GET /api/spans/:id/payload` (`jsonpath`, `range`, `max_chars`). | slicing helpers | upstream |

### Database

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/db/schema.ts` (171 LOC) | Drizzle schema. 9 tables + 1 view. | `runs`, `spans`, `live_events`, `saved_run_cache`, `saved_events`, `saved_folders`, `sessions`, `messages`, `annotations`, view `runs_with_hints` | upstream |
| `src/db/migration-assets.ts` | Embeds generated SQL into the daemon binary so it can migrate without an external `drizzle/` directory. | `embeddedMigrationFiles`, `embeddedMigrationJournal` | upstream |

### Agent / chat sidepanels

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/agents.ts` (130 LOC) | Sub-agent detection from span trees. Pattern: `TOOL_CALL > LLM_GENERATION > TOOL_CALL` or `TOOL_CALL > agent.subagent`. | `detectSubAgents()` (`src/agents.ts:44-130`) | upstream |
| `src/agents-config.ts` (627 LOC) | Agent registry: replay config, port allocation, `agents.json` / `agents.yaml` migration. | `AgentConfig`, `AgentsConfig`, `ensureAgentEndpoint()` | upstream |
| `src/agent-chat.ts` | Provider-agnostic chat dispatcher used by `POST /api/agent/messages`. | chat handler | upstream |
| `src/replay.ts` (367 LOC) | Replay engine. Drives the registered local agent against prefilled context. | `runReplay()` (`src/replay.ts:356-362`), `runLocalAgentReplay()` (`:180-354`), `ReplayConfig` (`:10-20`) | upstream |
| `src/replay-map.ts` | Maps replay run IDs to in-flight state. | map helpers | upstream |
| `src/claude-sessions.ts` | Claude-specific session listing (mounted under `/api/claude/*`). | claude session helpers | upstream (removed in planned F-002) |
| `src/claude-cli-chat.ts` | Bridges Claude CLI chat into the sidepanel. | bridge | upstream (removed in planned F-002) |
| `src/claude-ask-user-question.ts` | Implements `claude_ask_user_question` WS event round-trip. | helpers | upstream (removed in planned F-002) |
| `src/codex-sessions.ts` | Codex session listing. | codex helpers | upstream |
| `src/codex-cli-chat.ts` | Bridges Codex CLI chat into the sidepanel. | bridge | upstream |
| `src/provider-options.ts` | Provider option list (model picker, base URL, etc.). | provider list | upstream |
| `src/annotations.ts` | Annotation persistence helpers. | helpers | upstream |

### MCP server (in-process tool surface)

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/mcp/index.ts` | MCP stdio server entry. | `runMcpServer()` | upstream |
| `src/mcp/tools.ts` | Registers the trace-read MCP tools (`get_current_run`, `get_run_outline`, `search_run`, `query_traces`, `get_span_payload`, …). | `registerTraceReadTools()` | upstream |

### Install / setup

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/install/detect.ts` | Detects installed agents (claude, codex, opencode, …). | `detectInstalledAgents()` | upstream |
| `src/install/plan.ts` | Builds an `InstallPlan` for the chosen agents and scope. | `buildInstallPlan()` | upstream |
| `src/install/apply.ts` | Applies an install plan (writes MCP server entries). | `applyInstallPlan()` | upstream |
| `src/install/registry.ts` | Loads/updates the local install registry. | registry helpers | upstream |
| `src/install/wizard.ts` | Interactive `raindrop setup` wizard. | wizard | upstream |
| `src/install/sync.ts` | Syncs registry after agent add/remove. | sync | upstream |
| `src/install/bundle.ts` | Bundles multiple installs. | bundle | upstream |
| `src/install/owned-mcp.ts` | Tracks MCP servers owned by raindrop (vs user-owned). | helpers | upstream |
| `src/install/custom-mcp.ts` | Custom MCP server entries. | helpers | upstream |
| `src/install/types.ts` | Shared install types (`InstallAgentId`, `InstallScope`, `InstallPlan`). | types | upstream |
| `src/init.ts` | `raindrop init` flow (project scaffold). | init | upstream |
| `src/init-skills.ts` | Scaffolds agent skills (e.g. `instrument-agent`, `setup-agent-replay`). | skill scaffolder | upstream |

### Cloud integration (planned to be trimmed by F-001)

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/cloud/cloud-mcp-proxy.ts` | Express sub-router that proxies MCP requests to Raindrop Cloud. | `CLOUD_MCP_PROXY_PATH` | upstream (trimmed in planned F-001) |
| `src/cloud/setup.ts` | `raindrop cloud setup` flow. | setup | upstream (trimmed in planned F-001) |
| `src/cloud/apply.ts` | Applies cloud config changes. | apply | upstream (trimmed in planned F-001) |
| `src/cloud/import-trace.ts` | Imports a cloud trace into the local DB. | import | upstream (trimmed in planned F-001) |
| `src/cloud/query-client.ts` | HTTP client for cloud query API. | client | upstream (trimmed in planned F-001) |
| `src/cloud/query-key.ts` | Query API key helpers. | helpers | upstream (trimmed in planned F-001) |
| `src/cloud/offer.ts` | Prompts user to enable cloud. | offer | upstream (trimmed in planned F-001) |
| `src/cloud/oauth.ts` → `src/auth/oauth.ts` | OAuth flow (under `src/auth/`). | oauth | upstream |
| `src/cloud/env-file.ts` | Reads/writes cloud env file. | env helpers | upstream (trimmed in planned F-001) |
| `src/cloud/transient-keys.ts` | Short-lived key cache. | helpers | upstream (trimmed in planned F-001) |
| `src/cloud/skills.ts` | Cloud skills install. | skills | upstream (trimmed in planned F-001) |
| `src/cloud/constants.ts` | Cloud constants (URLs, paths). | constants | upstream (trimmed in planned F-001) |
| `src/cloud/uninstall.ts` | `raindrop cloud uninstall`. | uninstall | upstream (trimmed in planned F-001) |

### Auth

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/auth/oauth.ts` | OAuth flow used by `raindrop login`. | oauth flow | upstream |
| `src/auth/login.ts` | `raindrop login` command. | login | upstream |
| `src/auth/token-store.ts` | Persistent token store. | token store | upstream |
| `src/auth/write-key.ts` | Write-key helpers. | helpers | upstream |
| `src/auth/constants.ts` | Auth constants. | constants | upstream |

### UI / assets

| Path | Responsibility | Key exports | Ownership |
|---|---|---|---|
| `src/ui-assets.ts` | UI asset bundler (imports built `app/dist`). | bundler | upstream |
| `src/ui-assets.compiled.ts` | Compiled UI asset module (generated, do not edit). | compiled assets | upstream |
| `src/demo-traces.ts` | Demo traces used by `/demo-chat` and `/api/demo-traces/replay`. | demo data | upstream |
| `src/embeds.d.ts` | Type declarations for embedded assets. | types | upstream |
| `src/skills.compiled.d.ts` | Type declarations for compiled skills. | types | upstream |

## End-to-end data flow

A single span emitted by an instrumented agent travels through these stages. Each step links the file (and line range where stable) that performs it.

1. **Plugin emits OTLP.** An instrumented agent SDK (Vercel AI SDK, Claude Agent SDK, LiveKit, Traceloop, or any plain OTLP exporter) POSTs an `ExportTraceServiceRequest` to the daemon. Default ingest base URL is `http://localhost:5899/v1/`. Three ingest routes accept the same payload: `POST /v1/traces`, `POST /v1/otel/v1/traces`, `POST /otel/v1/traces` — all defined in `src/server.ts:822-824` and all funnelling into the same handler.

2. **Daemon ingests.** The handler in `src/server.ts:822-877` accepts both JSON and `application/x-protobuf` bodies. For binary bodies it delegates to the protobuf decoder; for JSON it parses inline. The body is then handed to `parseOtlpRequest(body)` in `src/parse.ts:124-242`.

3. **Protobuf decode.** Binary OTLP requests are decoded by `decodeOtlpProtobuf(buf)` at `src/otlp-protobuf.ts:158-178`, which uses the proto definition embedded at `src/otlp-protobuf.ts:3-94` to produce the same JSON-shaped `ResourceSpans → ScopeSpans → Span` tree as the JSON path.

4. **Parse to `ParsedSpan`.** `parseOtlpRequest()` flattens OTLP into a per-span record. `inferSpanType()` at `src/parse.ts:35-69` reads `raindrop.span.kind` (`agent_root` / `trace` / `llm_call` / `tool_call`) and any adapter-specific kind attributes, mapping each to one of `LLM_GENERATION`, `TOOL_CALL`, `AGENT_ROOT`, `TRACE`, `INTERNAL`. Status codes are mapped at `src/parse.ts:95-108`.

5. **Normalize to `NormalizedSpan`.** Each parsed span is passed to `normalizeSpan()` at `src/spans/normalize.ts:42-48`, which iterates the `ADAPTERS` array (`:32-40`) and asks each adapter (`ai-sdk`, `claude-agent-sdk`, `livekit`, `traceloop`) whether it claims the span. The winning adapter (or the default fallback) returns an `AdapterMatch` carrying the typed `NormalizedSpan`. Per-adapter logic lives under `src/spans/adapters/`; the shared contract is `AdapterInput` / `AdapterMatch` at `src/spans/adapters/types.ts:1-29`.

6. **SQLite insert.** The span is inserted into the `spans` table (`src/db/schema.ts:23-47`). If its `traceId` is new, a row is also inserted into `runs` (`:4-21`) and the run is created. The DB layer lives in `src/db.ts` (Drizzle over `bun:sqlite`); the path is resolved by `resolveDbPath()` at `src/db.ts:20-26` (env override `RAINDROP_WORKSHOP_DB_PATH`, default `~/.raindrop/raindrop_workshop.db`). All DB access from routes goes through this module — the daemon never talks to SQLite directly.

7. **WebSocket broadcast.** After a successful insert, the daemon broadcasts a `spans` event (`{ event: "spans", data: { ...newRunIds } }`) to every connected WS client. Broadcast call sites are clustered around ingest (`src/server.ts:812, :976`), cloud import (`:1160, :1916`), and demo replay (`:2056`). The WS server itself is created once at `src/server.ts:413-424` on `path: "/ws"` with loopback-only `verifyClient`. Wire format on both directions is `{ event: string, data: any }`.

8. **React UI render.** The SPA (source under `app/`, built into `app/dist` and served by the `GET *` catch-all at `src/server.ts:2312`) receives the `spans` event, updates its in-memory run/span cache, and re-renders the run list / span tree / payload viewer. On selecting a run or span the UI sends a `ui_view` message back over the socket (`src/server.ts:622-626`), which updates `viewingRegistry` so the sidepanel assistant can ask "what is the user looking at right now".

9. **Sidepanel read-back (optional).** The sidepanel assistant (Claude, Codex, or any agent that speaks the agent-chat protocol) reads traces back through MCP tools (`src/mcp/tools.ts`) or through the in-process HTTP API under `/api/runs/:id/...` (`src/server.ts:1253-1325`). Both surfaces call into the same `src/db.ts` query helpers, so the read path shares its normalization with the write path: stored spans are re-run through `normalizeStoredSpan()` (re-using the adapter dispatcher from step 5) so UI and tools always see consistent shapes.

### Failure-localisation shortcut

If a span does not appear in the UI, walk the steps above in order:

| Symptom | Most likely culprit file |
|---|---|
| Daemon logs no request at all | Plugin / SDK config (check `RAINDROP_LOCAL_DEBUGGER` is set to the daemon URL) |
| Request arrives but body is rejected | `src/parse.ts:124-242`, `src/otlp-protobuf.ts:158-178` |
| Body parses but span shape is wrong | `src/spans/normalize.ts:42-48` and the relevant adapter under `src/spans/adapters/` |
| Normalize succeeds but no row appears | `src/db.ts` query helpers, `src/db/schema.ts:23-47` |
| Row exists but UI does not update | WS broadcast at `src/server.ts:812, :976`; verify `path: "/ws"` loopback-only `verifyClient` at `:413-424` |
| UI updates but sidepanel can't see the span | MCP tools in `src/mcp/tools.ts`, or the `/api/runs/:id/...` handlers at `src/server.ts:1253-1325` |

## Upstream-vs-fork boundary

This repository is a fork of [`raindrop-ai/workshop`](https://github.com/raindrop-ai/workshop). The boundary below decides which files are safe to edit in the fork and which require coordination with upstream.

### Upstream-owned (do NOT edit without explicit user override)

These paths come from upstream verbatim. Editing them in the fork produces rebase conflicts the next time the fork tracks upstream.

| Path | Reason |
|---|---|
| `AGENTS.md` (root) | Top-level agent guide maintained upstream. |
| `docs/` | User-facing documentation shipped by upstream. |
| `LICENSE` | License file; legal text must match upstream exactly. |
| `bun.lock` | Lockfile; regenerated by `bun install`, never hand-edited. |
| `package.json` | Manifest; fork changes here break `bun install` rebase hygiene. The fork uses `ai-docs/AGENTS.md` for project-specific guidance instead. |
| `src/` | All source under `src/`. The fork does not modify daemon/SDK code. (See `src/cloud/*` for files tagged `trimmed in planned F-001` — those are upstream files slated for upstream removal, not fork edits.) |

### Fork-only (safe to edit freely)

These paths do not exist upstream. They carry the fork's planning, agents, docs, and tooling.

| Path | Purpose |
|---|---|
| `ai-docs/` | This directory. AI-facing technical reference (ARCHITECTURE, API, DATABASE, PLUGIN-CONTRACT, DEVELOPMENT, AGENTS). |
| `openspec/` | OpenSpec change tracking: proposals, designs, specs, tasks. Lives entirely in the fork. |
| `.opencode/` | OpenCode agent configuration (agents, subagents, skills, MCP servers, permission rules). |
| `.omo/` | Prometheus / OhMyOpenCode work plans and boulder state. |

### Fork-modified (none)

This fork currently carries no intentional modifications to upstream files. All fork-specific guidance lives in fork-only paths. When a fork modification becomes necessary, add an entry here naming the file, the diff, and the upstream issue/PR tracking the change so the modification can be re-applied (or dropped) after the next rebase.

## Source anchors & citation

Every claim above cites a concrete path (and line range where stable) so a reader can jump from doc to source without re-searching. Citation format: `` `src/path/to/file.ts` `` for whole-file claims, `` `src/path/to/file.ts:LL-LL` `` for line-anchored claims. When updating this document, prefer line-anchored citations — they survive renames better and surface staleness immediately (a citation pointing past end-of-file is an unambiguous signal the doc needs to be re-anchored).

Key entry-point anchors a contributor will reach for repeatedly:

- CLI entry → `src/index.ts`
- Daemon factory → `src/server.ts:410-2316` (`createServer(port)`)
- WebSocket server → `src/server.ts:413-424`
- OTLP ingest handlers → `src/server.ts:822-877`
- DB open + migrations → `src/db.ts:20-26` (`resolveDbPath`), `src/db.ts:28+` (migrations)
- Drizzle schema → `src/db/schema.ts:1-171`
- Span normalize dispatcher → `src/spans/normalize.ts:32-48`
- Adapter contract → `src/spans/adapters/types.ts:1-29`
- Sub-agent detection → `src/agents.ts:44-130`
- Replay engine → `src/replay.ts:180-362`
- MCP tool registration → `src/mcp/tools.ts`
- UI catch-all → `src/server.ts:2312`
