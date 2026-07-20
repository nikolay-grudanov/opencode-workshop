# API Reference

This is the exhaustive reference for every HTTP route and WebSocket event exposed by the Raindrop Workshop daemon (`src/server.ts`). The daemon is local-only: it binds to loopback and rejects any non-loopback remote address with `403 {"error":"forbidden"}` (`src/server.ts:647-652`). There is no authentication; see [Auth and config caveats](#auth-and-config-caveats) below.

Conventions:

- All paths are relative to the daemon base URL — by default `http://localhost:5899`. Override with `RAINDROP_WORKSHOP_PORT` (see `src/index.ts:58`).
- Every route and event entry cites the source line where it is registered. Format: `` `src/server.ts:LL` `` or `` `src/server.ts:LL-LL` ``.
- Routes are grouped by surface. Within each group the table lists method, path, body, response, status codes, citation. A single `curl` example follows each group.
- Routes whose fate is tied to a planned OpenSpec change are tagged with the change ID. "Planned F-001" refers to `remove-cloud-integration-f001`. "Planned F-002" refers to the planned OpenCode-only narrowing of the sidepanel.

## HTTP route catalog

### Ingest (OTLP / Raindrop SDK)

These are the routes an instrumented agent SDK posts to. They are mounted at `/v1/*` and `/otel/*` rather than under `/api/*`.

| Method | Path | Body | Response | Status | Citation |
|---|---|---|---|---|---|
| POST | `/v1/traces` | OTLP `ExportTraceServiceRequest` (JSON **or** `application/x-protobuf`) | `{ message: "ok" }` | 200, 400 (bad protobuf), 500 (ingest failure) | `src/server.ts:822` |
| POST | `/v1/otel/v1/traces` | same | same | same | `src/server.ts:823` |
| POST | `/otel/v1/traces` | same | same | same | `src/server.ts:824` |
| POST | `/v1/live` | `{ traceId, spanId?, type, content?, timestamp, metadata? }` — `spanId` required for `tool_start` / `tool_result` types | `{ ok: true }` | 200, 400 (`traceId and type required`), 400 (missing `spanId`), 500 | `src/server.ts:826-877` |
| POST | `/v1/events/track_partial` | partial event body (event name + accumulating fields) | `{ ok: true }` or saved-event id when finalised | 200, 400, 500 | `src/server.ts:878-981` |
| POST | `/v1/events/track` | `{ event_name, user_id?, convo_id?, timestamp, user_input?, assistant_output?, signals?, properties?, source?, folder? }` | `{ id }` (saved_events row id) | 200, 400, 500 | `src/server.ts:982-990` |
| POST | `/v1/users/identify` | `{ user_id, ...props }` | `{ ok: true }` | 200 | `src/server.ts:991-993` |
| POST | `/v1/signals/track` | `{ event_name, signal, ... }` | `{ ok: true }` | 200 | `src/server.ts:994-996` |

```bash
# Submit a trace (JSON OTLP)
curl -sS http://localhost:5899/v1/traces \
  -H 'content-type: application/json' \
  -d '{"resourceSpans":[{"scopeSpans":[{"spans":[{"traceId":"abcdef","spanId":"01","name":"ai.streamText","kind":3,"startTimeUnixNano":"1700000000000000000","endTimeUnixNano":"1700000001000000000"}]}]}]}'

# Push a live event
curl -sS http://localhost:5899/v1/live \
  -H 'content-type: application/json' \
  -d '{"traceId":"abcdef","type":"tool_start","spanId":"01","content":"reading file","timestamp":1700000000000}'
```

### System / UI

| Method | Path | Body | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/health` | none | `{ status: "ok" }` | 200 | `src/server.ts:708` |
| GET | `/demo-chat` | none | HTML page for the in-process demo chat | 200 | `src/server.ts:712` |
| POST | `/api/demo-chat` | `{ messages: [{role, content}, ...], model? }` — at least one user message required | `{ message: "..." }` (assistant reply) | 200, 400 (no user message / no API key), 500 | `src/server.ts:716-727` |
| POST | `/api/demo-traces/replay` | `{ runId }` | `{ ok: true }` | 200, 500 | `src/server.ts:728-735` |
| GET | `/api/ui/connected` | none | `{ connected: boolean }` | 200 | `src/server.ts:1023` |
| GET | `/api/ui/viewing` | none | latest `ViewingEntry` or `404 {"error":"No UI reporting a view"}` | 200, 404 | `src/server.ts:1026-1029` |
| GET | `/api/status` | none | build/version info, agent provider, workspace status | 200 | `src/server.ts:1754` |
| POST | `/api/clear` | none | `{ ok: true }` (also broadcasts `clear` over WS) | 200 | `src/server.ts:1328` |
| GET | `/api/directories` | none | list of project directories (loopback-only guard) | 200 | `src/server.ts:1372` |
| GET | `/api/models/anthropic` | none | list of Anthropic models | 200 | `src/server.ts:1778` |
| POST | `/api/summarize` | `{ text, ... }` | `{ summary: string }` | 200, 500 | `src/server.ts:2061` |

```bash
curl -sS http://localhost:5899/health
curl -sS http://localhost:5899/api/ui/connected
curl -sS http://localhost:5899/api/status
```

### Runs, spans, and trace queries

These routes are the read surface used by the React UI and the sidepanel assistant (via HTTP fallback when MCP is unavailable).

| Method | Path | Query | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/api/runs` | `limit?: number` (default daemon-side) | array of `Run` rows (most recent first) | 200, 404 (`{"error":"No runs yet"}`) | `src/server.ts:998-1002` |
| GET | `/api/runs/active` | none | currently-active run or `null` | 200 | `src/server.ts:1003-1007` |
| POST | `/api/traces/query` | body `{ sql: string, limit?: number }` — read-only SELECT only | `{ rows: [...] }` | 200, 400 (`sql required`), 400 (rejected query — non-SELECT, CTE, etc.) | `src/server.ts:1008-1021` |
| GET | `/api/spans/:id` | none | `{ ...spanMeta, input_chars, output_chars, input_preview, output_preview }` | 200, 404 (`Span not found`) | `src/server.ts:1174-1185` |
| GET | `/api/spans/:id/payload` | `target=input\|output` (required), `jsonpath?`, `range=a,b` (UTF-16 char offsets), `max_chars?`, `format=json\|text` | `{ span_id, target, ...sliceResult }` | 200, 400 (`target must be input or output`, `max_chars must be a finite number`), 404 | `src/server.ts:1186-1214` |
| GET | `/api/spans/:id/context` | `before?: number`, `after?: number`, `include_parent?: "false"\|default true` | `{ parent?, before: [...], span, after: [...] }` | 200, 400, 404 | `src/server.ts:1215-1236` |
| GET | `/api/convo/:convoId` | none | array of runs sharing that `convo_id` | 200 | `src/server.ts:1237` |
| GET | `/api/runs/detail/<id>` (regex) | none | `{ run, spans, savedEvents? }` | 200, 404 | `src/server.ts:1239-1252` |
| GET | `/api/runs/:id/outline` | `payload_preview_chars?: number` (default 80) | run outline `{ run, span counts, first/final LLM preview, flat span list, ... }` | 200, 404 (`Not found`) | `src/server.ts:1253-1259` |
| GET | `/api/runs/:id/spans` | filters: `span_type`, `status`, `name`, `name_regex`, `model`, `parent_span_id`, `has_payload_match`, `min_duration_ms`, `min_tokens`; paging: `limit`, `offset`, `payload_preview_chars`; sort: `sort` | `{ spans: [...], total }` | 200 | `src/server.ts:1260-1277` |
| GET | `/api/runs/:id/search` | `pattern` (required), `regex=true`, `case_sensitive=true`, `scope=span_input,span_output,...`, `span_type`, `context_chars`, `max_matches` | `{ matches: [...] }` | 200, 400 (`pattern required`, `context_chars must be a finite number`, `max_matches must be a finite number`) | `src/server.ts:1278-1306` |
| GET | `/api/runs/:id/events` | `after_id?: number`, `types?: csv`, `limit?: number` | `{ events: [...] }` | 200, 400 (`after_id must be a finite number`) | `src/server.ts:1307-1327` |
| DELETE | `/api/runs/:id` | none | `{ ok: true }` (also broadcasts `spans` over WS to refresh run list) | 200 | `src/server.ts:1913` |

```bash
# List the most recent runs
curl -sS http://localhost:5899/api/runs

# Get the structural outline of a run
curl -sS "http://localhost:5899/api/runs/$RUN_ID/outline?payload_preview_chars=200"

# Read a slice of a span's input payload
curl -sS "http://localhost:5899/api/spans/$SPAN_ID/payload?target=input&max_chars=4000&format=json"

# Search a run for "backoff"
curl -sS "http://localhost:5899/api/runs/$RUN_ID/search?pattern=backoff&context_chars=120"

# Custom SQL query (read-only)
curl -sS -X POST http://localhost:5899/api/traces/query \
  -H 'content-type: application/json' \
  -d '{"sql":"SELECT span_type, COUNT(*) FROM spans WHERE run_id = ? GROUP BY span_type","limit":50}'
```

### Cloud-related (removed in planned F-001)

These routes proxy to Raindrop Cloud. They will be deleted when `remove-cloud-integration-f001` lands and should not be relied on by new code in the fork.

| Method | Path | Body / Query | Response | Status | Citation |
|---|---|---|---|---|---|
| POST | `/api/cloud/traces/import` | `{ event_id }` (loopback-only guard) | imported run descriptor | 200, 400 (`event_id required`), 500 (cloud import failure) | `src/server.ts:1149-1172` |
| GET | `/api/query/signals` | cloud query passthrough | cloud response | 200, 500 | `src/server.ts:1105` |
| GET | `/api/query/events/search` | cloud query passthrough | cloud response | 200, 500 | `src/server.ts:1108` |
| GET | `/api/query/events` | cloud query passthrough | cloud response | 200, 500 | `src/server.ts:1111` |
| GET | `/api/query/traces` | cloud query passthrough | cloud response | 200, 500 | `src/server.ts:1114` |
| POST | `/api/import-run` | cloud import hand-off | imported run | 200, 500 | `src/server.ts:2029` |

```bash
# Example — will return 404 after F-001 lands
curl -sS -X POST http://localhost:5899/api/cloud/traces/import \
  -H 'content-type: application/json' \
  -d '{"event_id":"evt_abc123"}'
```

### Secrets (in-process secret store)

| Method | Path | Body | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/api/secrets` | none | `{ [key]: string }` (masked values) | 200 | `src/server.ts:1040` |
| PUT | `/api/secrets/:key` | `{ value: string }` | `{ ok: true }` (broadcasts `secrets_updated`) | 200, 400 (validation on Query API key shape — `src/server.ts:1058`), 404 (`unknown secret key`) | `src/server.ts:1044-1064` |
| DELETE | `/api/secrets/:key` | none | `{ ok: true }` (broadcasts `secrets_updated`) | 200, 404 | `src/server.ts:1066-1078` |

```bash
curl -sS http://localhost:5899/api/secrets
curl -sS -X PUT http://localhost:5899/api/secrets/ANTHROPIC_API_KEY \
  -H 'content-type: application/json' -d '{"value":"sk-ant-..."}'
```

### Annotations

| Method | Path | Body / Query | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/api/annotations` | `run_id` (required) | array of annotations | 200 | `src/server.ts:1841-1849` |
| POST | `/api/annotations` | `{ run_id, span_id?, kind: "issue"\|"good"\|"note", note, source?: "user"\|"claude-code"\|"codex" }` | created annotation (broadcasts `annotation`) | 200, 400 | `src/server.ts:1850-1893` |
| DELETE | `/api/annotations/:id` | none | `{ ok: true }` (broadcasts `annotation` with delete semantics) | 200, 404 | `src/server.ts:1894-1912` |

```bash
curl -sS "http://localhost:5899/api/annotations?run_id=$RUN_ID"
curl -sS -X POST http://localhost:5899/api/annotations \
  -H 'content-type: application/json' \
  -d '{"run_id":"'"$RUN_ID"'","kind":"issue","note":"missing backoff","source":"user"}'
```

### Saved runs, folders, and events

| Method | Path | Body / Query | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/api/saved-runs` | none | list of saved runs | 200 | `src/server.ts:1943` |
| GET | `/api/saved-runs/folders` | none | list of folders | 200 | `src/server.ts:1947` |
| POST | `/api/saved-runs/folders` | `{ name, color }` | created folder (broadcasts `workspace_changed`) | 200, 400 | `src/server.ts:1951-1957` |
| DELETE | `/api/saved-runs/folders/:name` (regex) | none | `{ ok: true }` | 200, 404 | `src/server.ts:1958-1963` |
| GET | `/api/saved-runs/events/:id` (regex) | none | saved-event row | 200, 404 | `src/server.ts:1964-1970` |
| PUT | `/api/saved-runs/events/:id` (regex) | full saved-event body | updated row | 200, 400, 404 | `src/server.ts:1971-2000` |
| PATCH | `/api/saved-runs/events/:id` (regex) | partial saved-event body | updated row | 200, 400, 404 | `src/server.ts:2001-2020` |
| DELETE | `/api/saved-runs/events/:id` (regex) | none | `{ ok: true }` | 200, 404 | `src/server.ts:2021` |
| PUT | `/api/saved-runs/cache/:id` (regex) | `{ data }` | `{ ok: true }` | 200 | `src/server.ts:1924` |
| GET | `/api/saved-runs/cache/:id` (regex) | none | cached run payload | 200, 404 | `src/server.ts:1929` |
| DELETE | `/api/saved-runs/cache/:id` (regex) | none | `{ ok: true }` | 200, 404 | `src/server.ts:1935` |

```bash
curl -sS http://localhost:5899/api/saved-runs
curl -sS http://localhost:5899/api/saved-runs/folders
curl -sS -X POST http://localhost:5899/api/saved-runs/folders \
  -H 'content-type: application/json' -d '{"name":"investigations","color":"#aabbcc"}'
```

### Workspace

| Method | Path | Body | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/api/workspace/active` | none | active workspace descriptor or `null` | 200 | `src/server.ts:1330-1338` |
| GET | `/api/workspace/registered` | none | list of registered workspaces | 200 | `src/server.ts:1339-1389` |
| POST | `/api/workspace/active` | `{ cwd }` | `{ ok: true, workspace }` (broadcasts `workspace_changed` + `agent_loadout`) | 200, 400 | `src/server.ts:1390-1413` |

```bash
curl -sS http://localhost:5899/api/workspace/active
curl -sS -X POST http://localhost:5899/api/workspace/active \
  -H 'content-type: application/json' -d '{"cwd":"'"$PWD"'"}'
```

### Agent sidepanel (provider-agnostic, narrowed in planned F-002)

| Method | Path | Body / Query | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/api/agent/provider` | none | `{ provider }` | 200 | `src/server.ts:1414-1417` |
| POST | `/api/agent/provider` | `{ provider: "claude" \| "codex" }` | `{ provider }` (broadcasts `agent_provider`, and `agent_loadout` if a workspace is active) | 200, 400 (`provider must be 'claude' or 'codex'`) | `src/server.ts:1418-1430` |
| GET | `/api/agent/sessions` | none | list of agent chat sessions | 200 | `src/server.ts:1431-1448` |
| GET | `/api/agent/loadout` | none | agent loadout (models, tools, prompts) | 200 | `src/server.ts:1449-1454` |
| GET | `/api/agent/sessions/:id` | none | session messages | 200, 404 | `src/server.ts:1455-1474` |
| POST | `/api/agent/messages` | `{ messages, model?, ... }` (loopback-only guard; SSE-streamed response) | text/event-stream of assistant deltas (broadcasts `agent_message_stream`) | 200, 400, 500 | `src/server.ts:1475-1606` |
| POST | `/api/agent-ui/commands` | `{ command, ... }` | `{ ok: true }` (broadcasts `agent_ui_command`) | 200, 400 | `src/server.ts:1118-1148` |

```bash
curl -sS http://localhost:5899/api/agent/provider
curl -sS -N http://localhost:5899/api/agent/messages \
  -H 'content-type: application/json' \
  -H 'accept: text/event-stream' \
  -d '{"messages":[{"role":"user","content":"summarize the active run"}]}'
```

### Claude-specific (removed in planned F-002)

These routes exist upstream for the Claude Code sidepanel integration. The fork is narrowing the sidepanel to OpenCode; F-002 will delete this group.

| Method | Path | Body / Query | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/api/claude/sessions` | none | list of Claude sessions | 200 | `src/server.ts:1607-1612` |
| GET | `/api/claude/loadout` | none | Claude loadout (also broadcast as `claude_loadout` on WS connect) | 200 | `src/server.ts:1613-1621` |
| GET | `/api/claude/sessions/:id` | none | session messages | 200, 404 | `src/server.ts:1622-1632` |
| POST | `/api/claude/ask-user-question/hook` | hook body from Claude CLI | `{ ok: true }` (queues a `claude_ask_user_question` WS event) | 200, 400 | `src/server.ts:1633-1645` |
| POST | `/api/claude/ask-user-question/:id/answer` | `{ answer }` | `{ ok: true }` | 200, 404 | `src/server.ts:1646-1658` |
| POST | `/api/claude/messages` | `{ messages, model?, ... }` (loopback-only guard; SSE-streamed) | text/event-stream (broadcasts `claude_message_stream`) | 200, 400, 500 | `src/server.ts:1659-1753` |

### Agent registry and replay

| Method | Path | Body / Query | Response | Status | Citation |
|---|---|---|---|---|---|
| GET | `/api/agents` | none | merged `{ ...agentsYamlContent, ...discoveredAgents }` (config from `agents.yaml` plus runtime-discovered agents) | 200 | `src/server.ts:2087-2091` |
| PUT | `/api/agents` | full agents document | `{ ok: true }` (broadcasts `agents_updated` with the saved document); 500 on save failure | 200, 500 | `src/server.ts:2092-2103` |
| POST | `/api/agents/refresh` | none | refreshed registry (broadcasts `agents_updated`) | 200, 500 | `src/server.ts:2104-2132` |
| GET | `/api/agents/health` | none | per-agent health check | 200 | `src/server.ts:2133-2136` |
| POST | `/api/agents/ask` | `{ agent, message, ... }` | streamed agent reply | 200, 400, 500 | `src/server.ts:2137-2262` |
| POST | `/api/replay/context` | `{ runId, ... }` | prefilled context for replay | 200, 400 | `src/server.ts:2263-2276` |
| POST | `/api/replay` | `{ runId, userMessage?, model?, systemPrompt?, context? }` | text/event-stream of replay events | 200, 400, 500 | `src/server.ts:2277-2311` |

```bash
curl -sS http://localhost:5899/api/agents
curl -sS -N -X POST http://localhost:5899/api/replay \
  -H 'content-type: application/json' \
  -d '{"runId":"'"$RUN_ID"'"}'
```

### UI catch-all

| Method | Path | Response | Status | Citation |
|---|---|---|---|---|
| GET | `*` (everything not matched above) | built Vite SPA from `builtAppDir`. Skipped when `DEBUGGER_DEV` is set so a separate Vite dev server can serve the UI. | 200, 404 (asset missing) | `src/server.ts:2312-2316` |

### Cloud MCP proxy mount

The daemon also mounts an Express sub-router at `CLOUD_MCP_PROXY_PATH` (constant from `src/cloud/cloud-mcp-proxy.ts`) that proxies MCP requests to Raindrop Cloud. The mount lives at `src/server.ts:690-696` and is removed in planned F-001.

## WebSocket event catalog

WebSocket server: `new WebSocketServer({ server, path: "/ws", verifyClient })` at `src/server.ts:413-424`. `verifyClient` rejects any non-loopback remote address, mirroring the HTTP guard.

Connection URL: `ws://localhost:5899/ws`.

Wire format (both directions): `{ event: string, data: any }` (server) / `{ type: string, ...fields }` (client). Frames are JSON. Malformed inbound frames are silently dropped (`src/server.ts:618-621`).

### Server → client events

| Event | Trigger | Payload shape | Citation |
|---|---|---|---|
| `claude_loadout` | on connect (if cached), on loadout change | Claude loadout descriptor | `src/server.ts:592, :608` |
| `agent_provider` | on connect, on provider change | `{ provider: string }` | `src/server.ts:610, :1425` |
| `agent_loadout` | on connect (if active workspace), on workspace change | agent loadout (models, tools) | `src/server.ts:593, :613` |
| `claude_ask_user_question` | on connect (for each pending), on new question | pending question descriptor | `src/server.ts:616` |
| `spans` | after every successful span/run insert, after run delete, after cloud import, after demo replay | `{ [runId]: { run, span_ids: [...] } }` | `src/server.ts:812, :976, :1160, :1916, :2056` |
| `live` | after a `/v1/live` event is persisted | `{ traceId, spanId, type, content, timestamp, metadata }` | `src/server.ts:861` |
| `secrets_updated` | after every secret PUT / DELETE | `{ [key]: maskedValue }` | `src/server.ts:1053, :1062, :1073` |
| `annotation` | after every annotation insert or delete | annotation row (or `{ id, deleted: true }`) | `src/server.ts:1138, :1878, :1897` |
| `agent_ui_command` | when the sidepanel asks the UI to navigate or compose | `{ command: "navigate_to_run" \| "compose_annotation", ... }` | `src/server.ts:1146, :1162` |
| `clear` | after `POST /api/clear` | `{}` | `src/server.ts:1328` |
| `workspace_changed` | after active workspace changes, after folder create | `{ workspace }` | `src/server.ts:1407` |
| `agent_message_stream` | during `POST /api/agent/messages` SSE | streamed delta chunk | `src/server.ts:1522` |
| `claude_message_stream` | during `POST /api/claude/messages` SSE | streamed delta chunk | `src/server.ts:1523, :1688` |
| `agents_updated` | after `PUT /api/agents` or `POST /api/agents/refresh` | full agents document | `src/server.ts:2097, :2107` |

### Client → server events

| Event | Purpose | Payload shape | Citation |
|---|---|---|---|
| `ui_view` | tell the daemon which run/span this client is currently looking at, so the sidepanel assistant can ask "what is the user viewing" via `/api/ui/viewing` | `{ type: "ui_view", run_id: string \| null, span_id: string \| null }` | `src/server.ts:622-626` |

### Minimal WS client (Node)

```js
import WebSocket from "ws";
const ws = new WebSocket("ws://localhost:5899/ws");
ws.on("open", () => {
  ws.send(JSON.stringify({ type: "ui_view", run_id: "run_abc", span_id: null }));
});
ws.on("message", (buf) => {
  const { event, data } = JSON.parse(buf.toString());
  if (event === "spans") console.log("new spans:", Object.keys(data));
});
```

## Status code and error shape reference

Every non-2xx response uses the same body shape:

```json
{ "error": "<human-readable message>" }
```

There is no `code` field. Dynamic messages (caught exceptions, validation failures) are interpolated into `error` directly from `(err as Error).message` — see `src/server.ts:554, :572, :720, :734, :1020, :1101, :1172, :1212, :1305` for representative call sites.

| Status | Trigger | Example body | Citation(s) |
|---|---|---|---|
| 400 | Malformed request body, missing required field, invalid query value, rejected SQL query | `{"error":"target must be input or output"}` | `src/server.ts:189, :195, :554, :747, :833, :835, :1011, :1020, :1058, :1122, :1153, :1189, :1198, :1221, :1228, :1281, :1291, :1299, :1312, :...` |
| 401 | (Historical) cloud auth missing or invalid — **removed in planned F-001**. After F-001 lands no daemon route returns 401. | `{"error":"..."}` | n/a after F-001 |
| 403 | Non-loopback remote address | `{"error":"forbidden"}` | `src/server.ts:649, :663, :682` |
| 404 | Unknown run id, span id, annotation id, secret key, saved-event id, folder name, or no UI reporting a view | `{"error":"Span not found"}` / `{"error":"Not found"}` / `{"error":"No runs yet"}` / `{"error":"No UI reporting a view"}` | `src/server.ts:1005, :1028, :1047, :1069, :1176, :1192, :1234, :1257, :...` |
| 500 | Caught exception during ingest, query, demo chat, replay, or cloud import | `{"error":"Failed to ingest"}` or `(err as Error).message` | `src/server.ts:572, :720, :734, :816, :872, :1101, :1172, :...` |

## Auth and config caveats

### Authentication

There is **no authentication**. The daemon is local-only and binds to loopback. Any non-loopback remote address is rejected at the socket layer with `403 {"error":"forbidden"}` (`src/server.ts:647-652`). The `verifyClient` callback on the WebSocket server enforces the same rule (`src/server.ts:413-424`).

A handful of historical routes (`/api/cloud/traces/import`, `/api/import-run`, the `/api/query/*` passthrough, the `CLOUD_MCP_PROXY_PATH` mount) relied on cloud auth (query API keys, OAuth tokens, write keys). Those routes are **removed in planned F-001** (`remove-cloud-integration-f001`). Until F-001 lands they continue to exist but the cloud credentials they read are stored in the local secret store under keys prefixed `RAINDROP_QUERY_API_KEY` / `RAINDROP_WRITE_KEY`. New fork code must not call these routes.

### Environment variables that affect API behaviour

| Variable | Default | Effect | Citation |
|---|---|---|---|
| `RAINDROP_WORKSHOP_PORT` | `5899` | Port the HTTP+WS daemon listens on. | `src/index.ts:58` |
| `RAINDROP_WORKSHOP_BIND_HOST` | `127.0.0.1` | Network interface to bind. Loopback by default; changing this exposes the daemon — keep loopback. | `src/index.ts:59` |
| `RAINDROP_WORKSHOP_DB_PATH` | `~/.raindrop/raindrop_workshop.db` | SQLite database path. See [DATABASE.md](./DATABASE.md). | `src/db.ts:20-26` |
| `RAINDROP_LOCAL_DEBUGGER` | unset | Base URL SDKs post OTLP to (e.g. `http://localhost:5899/v1/`). Written into agent configs by `raindrop workshop setup`. | `src/index.ts:451` |
| `RAINDROP_WORKSHOP_URL` | derived | Canonical daemon URL used for browser launch / manifests. | `src/index.ts:112` |
| `RAINDROP_WORKSHOP_ALLOWED_ORIGINS` | unset | Comma-separated extra origins allowed by CORS for the ingest routes. | `src/server.ts:444` |
| `RAINDROP_WORKSHOP_CLAUDE_CLI_CHAT` | unset | Override path to the Claude CLI binary used by `/api/claude/messages`. | `src/server.ts:441` |
| `RAINDROP_WORKSHOP_UI_PORT` | `5900` | Port used by the Vite dev server in `bun run dev:ui`. Not used by the daemon itself. | `package.json` scripts |
| `DEBUGGER_DEV` | unset | When set, the `GET *` catch-all is skipped so a separate Vite dev server can serve the UI on its own port. | `src/server.ts:2309` |
| `RAINDROP_MANIFEST_URL` | upstream manifest | Self-update manifest URL. | `src/update.ts` |
| `RAINDROP_QUERY_API_KEY` / `RAINDROP_WRITE_KEY` | unset | Cloud credentials. **Removed in planned F-001.** | `src/cloud/*` |

For the full environment-variable reference (including ones that affect CLI behaviour but not the API) see [DEVELOPMENT.md](./DEVELOPMENT.md).

## Source citation per route

Every entry in this document carries a `src/server.ts:LL` or `src/server.ts:LL-LL` citation. When reviewing this doc against the implementation:

- For each row, open the cited line range in `src/server.ts`.
- Confirm the method, path, body shape, response shape, and status codes still match.
- If you find drift, update this doc **and** add an entry to the change's tasks file noting the re-anchoring.

Routes registered via regex (e.g. `app.get(/^\/api\/runs\/detail\/(.+)$/, ...)`) cite the line where the `app.get(regex, ...)` call begins. Path parameters captured from regex routes are exposed as `req.params[0]`, `req.params[1]`, etc. rather than named keys — see `src/server.ts:1239-1240` for the canonical example.
