# Plugin contract

This document is the wire-level contract between **Raindrop Workshop** (the
local daemon at `http://localhost:5899` by default) and any plugin or SDK
that publishes traces to it. It is the single source of truth that
companion projects — including Kolya's `opencode-workshop-plugin` fork —
implement against.

It is **not** a tutorial. For the architecture of the ingest pipeline, see
`ai-docs/ARCHITECTURE.md`. For the HTTP surface area at large, see
`ai-docs/API.md`. For what gets persisted after a successful ingest, see
`ai-docs/DATABASE.md`.

---

## OTLP ingest endpoint contract

### Endpoint URLs

The daemon accepts OTLP trace exports at three aliased paths, all bound to
the same handler (`src/server.ts:739`, named `ingestTraces`):

| Method | Path | Registered at |
|---|---|---|
| `POST` | `/v1/traces` | `src/server.ts:822` |
| `POST` | `/v1/otel/v1/traces` | `src/server.ts:823` |
| `POST` | `/otel/v1/traces` | `src/server.ts:824` |

The three aliases exist so different OTLP exporters (the direct
`@opentelemetry/otlp-exporter-base` shipper, Traceloop, the legacy
OpenLLMetry path) can use their hard-coded default path without a
configuration override. Pick whichever your SDK prefers; the daemon does
not differentiate.

### Daemon base URL

The daemon listens on `http://localhost:5899` by default
(`src/index.ts:74`, also surfaced by `raindrop workshop status`). The
ingest base URL is **`http://localhost:5899/v1/`** — that is what
`raindrop workshop setup` writes into `RAINDROP_LOCAL_DEBUGGER`
(`src/index.ts:397`, `:424`, and the default in `src/agents-config.ts:464`).

The full canonical ingest URL is therefore:

```
http://localhost:5899/v1/traces
```

### Accepted `Content-Type` values

Two body parsers are mounted before the ingest handler:

```ts
app.use(express.json({ limit: "50mb" }));                                   // src/server.ts:699
app.use(express.raw({ limit: "50mb", type: "application/x-protobuf" }));    // src/server.ts:701
```

| `Content-Type` | Body shape | How the handler parses it |
|---|---|---|
| `application/json` | OTLP JSON (`ExportTraceServiceRequest` shape) | `req.body` is already a JS object — passed straight to `parseOtlpRequest` (`src/parse.ts:124`). |
| `application/x-protobuf` | OTLP protobuf bytes | `req.body` is a `Buffer`; `decodeOtlpProtobuf(body)` (`src/otlp-protobuf.ts:158-178`) decodes it back into the same `ExportTraceServiceRequest` shape. |
| *(other / omitted)* | If the body arrives as a `Buffer`, the protobuf decoder is tried first (`src/server.ts:742-750`); otherwise it is treated as JSON. |

A 50 MB upper bound applies to either encoding. Go above it and the body
parser rejects the request before the ingest handler runs.

### Request body shape

OTLP `ExportTraceServiceRequest`. The daemon walks
`resourceSpans[].scopeSpans[].spans[]` (`src/parse.ts:127-129`). Anything
outside that skeleton is ignored, so a minimal valid request looks like:

```json
{
  "resourceSpans": [
    {
      "scopeSpans": [
        {
          "spans": [
            {
              "traceId": "0123456789abcdef0123456789abcdef",
              "spanId": "0123456789abcdef",
              "name": "agent.run",
              "kind": "SPAN_KIND_INTERNAL",
              "startTimeUnixNano": "1720000000000000000",
              "endTimeUnixNano":   "1720000000123456789",
              "attributes": [
                { "key": "raindrop.span.kind", "value": { "stringValue": "agent_root" } }
              ],
              "status": { "code": 1 }
            }
          ]
        }
      ]
    }
  ]
}
```

The protobuf wire format uses the same field names (camelCase on the JSON
side per the OTLP JSON convention). The Protobuf definition the daemon
decodes against lives at `src/otlp-protobuf.ts:3-94`.

### Response codes

| Status | Body | When |
|---|---|---|
| `200 OK` | `{ "ok": true, "spansIngested": <n> }` | Successful ingest. `<n>` may be `0` if the request parsed but contained no spans (`src/server.ts:752`). |
| `400 Bad Request` | `{ "error": "Failed to decode protobuf OTLP body" }` | Protobuf decode failed (`src/server.ts:745-748`). JSON-side malformed bodies surface as a thrown exception inside `parseOtlpRequest` and come back as a 500. |
| `500 Internal Server Error` | `{ "error": "Failed to ingest" }` | Any other exception during parsing or persistence (`src/server.ts:814-817`). |

There is **no auth**: ingest is unauthenticated but loopback-only. Non-
loopback origins receive `403 Forbidden` from the connection guard at
`src/server.ts:647-652` before the ingest handler is reached. See
`ai-docs/API.md` for the auth/connection model.

### Streaming live events

In addition to the OTLP trace export, plugins may push streaming "live
events" through `POST /v1/live` (`src/server.ts:826-874`). These are
intended for incremental UI updates while a run is still in flight (text
deltas, reasoning deltas, tool start / tool result markers).

Required body fields:

```json
{
  "traceId": "0123456789abcdef0123456789abcdef",
  "type": "text_delta",
  "content": "...",
  "timestamp": 1720000000000,
  "spanId": "0123456789abcdef",
  "metadata": { "optional": true }
}
```

`traceId` and `type` are required (`src/server.ts:833`). `spanId` is
required only for `tool_start` / `tool_result` events
(`src/server.ts:834-836`); other event types may omit it. The handler
responds with `{ "ok": true }` on success.

---

## Span shape contract

### Required fields

The plugin MUST emit the following per-span fields. "Required" means the
ingester expects them to be present in the OTLP payload; missing values
are coerced to defaults that may degrade UI behavior.

| Field | Type | Source line | Notes |
|---|---|---|---|
| `traceId` | 16-byte hex string (32 chars) | `src/parse.ts:220` | Normalized by `normalizeOtelId(s.traceId, 16)`. Becomes `runs.id`. |
| `spanId` | 8-byte hex string (16 chars) | `src/parse.ts:221` | Normalized by `normalizeOtelId(s.spanId, 8)`. Becomes `spans.id`. |
| `name` | string | `src/parse.ts:149` | Tool calls are renamed to the actual tool name (`src/parse.ts:150-154`). |
| `startTimeUnixNano` | uint64 string | `src/parse.ts:131,133` | Coerced to epoch ms. Missing or `"0"` lands as `0`. |
| `endTimeUnixNano` | uint64 string | `src/parse.ts:132,134` | Same coercion as start. |

### Optional fields

| Field | Type | Source line | Effect when omitted |
|---|---|---|---|
| `parentSpanId` | 8-byte hex string | `src/parse.ts:222-225` | Treated as a root span. The run-outliner uses root-status to derive `runs_with_hints.finished`. |
| `attributes[]` | OTLP key/value array | `src/parse.ts:130` | Span falls back to `INTERNAL` span_type (`src/parse.ts:68`). |
| `events[]` | OTLP event array | `src/parse.ts:115-119` | Only consulted for exception message extraction. |
| `status.code` | OTel enum int (`0` \| `1` \| `2`) | `src/parse.ts:95-108` | Coerced to `"OK"` — see "Status mapping" below. |
| `status.message` | string | `src/parse.ts:111-113` | Used as the error message if attached. |
| `resource` | OTLP resource block | — | Currently ignored by the ingester. |

### The `raindrop.span.kind` attribute — primary span typing

The single source of truth for span role is the
`raindrop.span.kind` attribute. When present, it overrides every
heuristic. Recognized values (`src/parse.ts:47-50`):

| `raindrop.span.kind` value | Becomes `span_type` | Convention |
|---|---|---|
| `agent_root` | `AGENT_ROOT` | Top-of-tree span for an agent run. Exactly one per trace in well-formed SDK output. |
| `trace` | `TRACE` | Mid-tree trace span (rare; mostly legacy). |
| `llm_call` | `LLM_GENERATION` | An LLM generation call. Carries model, token counts. |
| `tool_call` | `TOOL_CALL` | A tool invocation. Renamed to the actual tool name (`src/parse.ts:150`). |

Any other value (or missing attribute) drops into the heuristic fallback
ladder (`src/parse.ts:56-68`): tool name presence, `traceloop.span.kind`,
`gen_ai.*` inference markers, `operationId` substring matches. The result
of fallback is `INTERNAL` when nothing matches.

> **Spec note.** The OpenTelemetry GenAI semantic conventions also define
> values like `CHAIN`, `RETRIEVER`, `EMBEDDING`. Workshop does **not**
> recognize those today; spans tagged with them fall through to
> `INTERNAL`. The fork's F-004 plan in `ai-docs/PLAN.md` tracks Phoenix-
> style GenAI alignment; until then, use the four values above.

### Status mapping

OTel status code → Workshop status string (`src/parse.ts:95-108`):

| OTel `status.code` | Workshop `status` |
|---|---|
| `1` (OK) | `"OK"` |
| `2` (ERROR) | `"ERROR"` |
| `0` / unset | `"OK"` |

Note the unset → OK coercion: OTLP exports on span end, so Workshop only
ever sees ended spans. Treating unset as OK lets the "is this run
finished?" derivation in `runs_with_hints.finished`
(`src/db/schema.ts:162-165`) converge instead of waiting forever for an
explicit OK that the SDK never sent.

### Other recognized attributes

These are read at ingest time and projected into typed `spans` columns.
The first matching key wins (`src/parse.ts:178-186`):

| Column | Attribute keys consulted (in order) |
|---|---|
| `model` | `ai.model.id`, `ai.response.model`, `gen_ai.request.model`, `gen_ai.response.model`, `llm.request.model` |
| `provider` | `ai.model.provider`, `gen_ai.system`, `gen_ai.provider.name`, `llm.system` |
| `input_tokens` | `ai.usage.inputTokens`, `ai.usage.promptTokens`, `ai.usage.prompt_tokens`, `gen_ai.usage.input_tokens` |
| `output_tokens` | `ai.usage.outputTokens`, `ai.usage.completionTokens`, `ai.usage.completion_tokens`, `gen_ai.usage.output_tokens` |
| `event_id` (run-level) | `ai.telemetry.metadata.raindrop.eventId`, `traceloop.association.properties.event_id` |
| `event_name` (run-level) | `ai.telemetry.metadata.raindrop.eventName`, `traceloop.association.properties.event_name` |
| `user_id` (run-level) | `ai.telemetry.metadata.raindrop.userId`, `traceloop.association.properties.user_id` |
| `convo_id` (run-level) | `ai.telemetry.metadata.raindrop.convoId`, `traceloop.association.properties.convo_id` |
| `replayRunId` (run-level) | `ai.telemetry.metadata.raindrop.replayRunId`, `traceloop.association.properties.replayRunId`, **or** `replayRunId` inside the JSON blob at `ai.telemetry.metadata.raindrop.properties` (`src/parse.ts:202-217`). |

Tool-name override (`src/parse.ts:144`):

| Looked-up attribute keys (in order) |
|---|
| `ai.toolCall.name`, `tool.name`, `lk.function_tool.name` |

Whichever is found first replaces `span.name` for `TOOL_CALL` spans. This
is why a tool invocation shows up as e.g. `read_file` instead of the
SDK's wrapper name `ai.toolCall`.

---

## Environment variable contract

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `RAINDROP_LOCAL_DEBUGGER` | **Yes** (set by `raindrop workshop setup`) | `http://localhost:5899/v1/` (`src/agents-config.ts:464`) | Base URL the plugin uses to publish traces. The plugin appends `traces`, `live`, etc. to this base. |
| `RAINDROP_WORKSHOP_PORT` | No | `5899` (`src/index.ts:58`) | Port the daemon listens on. Override on the daemon side; the plugin should pick up the same value indirectly via `RAINDROP_LOCAL_DEBUGGER`. |
| `RAINDROP_WORKSHOP_BIND_HOST` | No | loopback only (`src/index.ts:59`) | Network interface the daemon binds to. Plugins should not need to read this. |
| `RAINDROP_WORKSHOP_DB_PATH` | No | `~/.raindrop/raindrop_workshop.db` | Where ingested spans are persisted. See `ai-docs/DATABASE.md`. |
| `RAINDROP_WORKSHOP_URL` | No | `http://localhost:<port>` (`src/index.ts:112`) | Browser-side URL the CLI opens on `raindrop workshop start`. |
| `RAINDROP_WORKSHOP_ALLOWED_ORIGINS` | No | derived from loopback | CORS allow-list for non-loopback browser access. |
| `RAINDROP_WORKSHOP_CLAUDE_CLI_CHAT` | No | — | Claude-specific override. **Removed in planned F-002** (see `ai-docs/PLAN.md`); do not rely on it for new plugins. |
| `RAINDROP_QUERY_API_KEY`, `RAINDROP_WRITE_KEY` | No | — | Cloud credentials. **Removed in planned F-001**; do not set in this fork. |

### Setting `RAINDROP_LOCAL_DEBUGGER`

The supported path is `raindrop workshop setup`, which writes the value
into `./.env` next to your project (`src/index.ts:397`, `:424`). Example
result:

```env
RAINDROP_LOCAL_DEBUGGER=http://localhost:5899/v1/
```

Plugins should read this variable at startup and fall back to
`http://localhost:5899/v1/` only when unset. Do not hard-code the
port — `raindrop workshop setup` will write whatever the daemon is
actually bound to.

---

## Sub-agent metadata expectation

Workshop detects sub-agents by **span-tree shape**, not by attribute
metadata. This section documents the current detection logic so plugin
authors can emit spans that are recognized as sub-agents. The
attribute-name contract (e.g. `subagent_name`, `description`) is
**planned for F-003** and is not yet consulted by the daemon.

### Current detection (src/agents.ts:44-130)

A sub-agent is identified when a `TOOL_CALL` span contains an agentic
loop in its subtree. Concretely (`src/agents.ts:61-84`), a `TOOL_CALL`
qualifies if **either** of the following holds:

1. **Strict agentic loop** (`src/agents.ts:71-76`): the `TOOL_CALL` has
   an `LLM_GENERATION` child whose own children include at least one
   `TOOL_CALL`. Pattern: `TOOL_CALL > LLM_GENERATION > TOOL_CALL`.
2. **Explicit name marker** (`src/agents.ts:78-81`): the `TOOL_CALL` has
   an `LLM_GENERATION` child whose `name` is exactly `"agent.subagent"`
   (the Claude Agent SDK convention). This pattern may omit tool
   grandchildren.

When either pattern matches, all descendant span IDs are collected
(`src/agents.ts:95-110`) and an `AGENT_ROOT`-like label is produced from
the parent `TOOL_CALL`'s `name` field (`src/agents.ts:115`). The
resulting sub-agent exposes:

```ts
interface SubAgent {
  root_span_id: string;       // The TOOL_CALL span that triggered this sub-agent
  name: string;               // The TOOL_CALL span's `name` (e.g. "task" or "agent.subagent")
  span_ids: string[];         // All descendant span IDs
  start_time_ms: number;
  end_time_ms: number;
  duration_ms: number;
  model: string | null;       // First non-null LLM child model
  status: string;
  llm_count: number;
  tool_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
}
```

Source: `src/agents.ts:25-42`.

### Attribute keys Workshop reads today

**None for sub-agent detection.** The detector at `src/agents.ts:44-130`
consults only `span_type`, `name`, `parent_span_id`, `model`, and
`status`. There is no lookup of `subagent_name`, `description`, or any
other attribute key.

This is intentional and is what makes Workshop a "dumb" consumer of the
generic `TOOL_CALL > LLM_GENERATION > TOOL_CALL` pattern: any SDK that
emits that shape will get sub-agent grouping for free.

### Forward reference — F-003

The fork's `ai-docs/PLAN.md` plans F-003 ("Sub-agent visualization for
OpenCode `task` tool") with two improvements relevant to plugin authors:

1. **Attribute-based naming** (`ai-docs/PLAN.md:132`): the OpenCode
   `task` tool will be patched to capture its `description` arg into
   span metadata. The planned attribute keys are `subagent_name` and/or
   `description`, sourced from the tool input args. Workshop will then
   read those keys in `src/agents.ts` to name sub-agents instead of
   falling back to the `task` tool's display name.

2. **Tool-name based detection** (`ai-docs/PLAN.md:139`): Workshop will
   also detect sub-agents by parent `TOOL_CALL` name === `"task"`
   (OpenCode convention), so the agentic-loop pattern is no longer the
   only entry point.

**Until F-003 ships**, plugins should:

- Emit a `TOOL_CALL` with `name === "task"` (or `ai.toolCall.name ===
  "task"`) at the start of every sub-agent invocation.
- Give that `TOOL_CALL` an `LLM_GENERATION` child whose `name ===
  "agent.subagent"` to opt into the explicit-name-marker branch.
- Optionally populate `attributes["subagent_name"]` and
  `attributes["description"]` so the data is ready to render once F-003
  lands. Workshop will ignore those keys today.

After F-003 ships, this section will be revised with the exact key names
and value shapes the daemon consults.

---

## Stability statement

This contract has two stability tiers. Plugin authors should re-test the
"in-flux" surface on every Workshop release before assuming backwards
compatibility.

### Stable

These parts have not changed across recent releases and are not on the
deprecation path:

- The three ingest endpoint paths (`/v1/traces`, `/v1/otel/v1/traces`,
  `/otel/v1/traces`) and the daemon base URL
  `http://localhost:5899/v1/`.
- The two accepted `Content-Type` values (`application/json`,
  `application/x-protobuf`) and the 50 MB body limit.
- The OTLP `ExportTraceServiceRequest` body shape — `resourceSpans →
  scopeSpans → spans`.
- The four `raindrop.span.kind` values (`agent_root`, `trace`,
  `llm_call`, `tool_call`) and the resulting `span_type` mapping.
- The required span fields: `traceId`, `spanId`, `name`,
  `startTimeUnixNano`, `endTimeUnixNano`.
- The status code mapping (OK / ERROR / unset → OK).
- The `RAINDROP_LOCAL_DEBUGGER` env var contract.
- The live-event streaming endpoint `POST /v1/live` and its required
  `traceId` / `type` fields.
- The sub-agent **shape-based** detection pattern `TOOL_CALL >
  LLM_GENERATION > TOOL_CALL` (or `agent.subagent` name marker).

### In-flux

These parts are subject to change without a major version bump. Plugin
authors must re-test on every Workshop release:

- **Sub-agent attribute-name contract.** The keys `subagent_name` and
  `description` are reserved for F-003 but are **not yet consulted**.
  Emit them defensively; do not depend on them being read.
- **Tool-name based sub-agent detection.** Today the detector only
  matches the tree shape. After F-003, it will also match
  `TOOL_CALL.name === "task"` directly.
- **Cloud credential env vars** (`RAINDROP_QUERY_API_KEY`,
  `RAINDROP_WRITE_KEY`) — removed in planned F-001. See `ai-docs/PLAN.md`.
- **Claude-specific env vars** (`RAINDROP_WORKSHOP_CLAUDE_CLI_CHAT`)
  and Claude-specific endpoints (`/api/claude/*`) — removed in planned
  F-002.
- **GenAI semantic-convention alignment.** Today the daemon recognizes
  the four `raindrop.span.kind` values plus heuristic fallbacks. Phoenix
  / OpenTelemetry GenAI conventions (`CHAIN`, `RETRIEVER`, `EMBEDDING`)
  are tracked by F-004 and may shift the recognized value set.

### How to validate compatibility

After every Workshop release:

1. Read this document's "In-flux" list and the matching `F-NNN` entries
   in `ai-docs/PLAN.md`.
2. Run a small smoke trace through your plugin and confirm it appears
   in the UI (`http://localhost:5899`).
3. For sub-agent flows specifically, confirm the sub-agent card still
   groups correctly in the run outline (see `ai-docs/DEVELOPMENT.md`
   for the smoke-test procedure).
4. If you depend on any attribute key listed as "in-flux", verify the
   daemon still reads it the same way (or, today, ignores it the same
   way).

---

## See also

- `ai-docs/ARCHITECTURE.md` — end-to-end ingest data flow and where
  `src/parse.ts`, `src/otlp-protobuf.ts`, and `src/spans/normalize.ts`
  sit in the pipeline.
- `ai-docs/API.md` — full HTTP surface area, including the `/v1/live`
  streaming endpoint and the loopback-only connection guard.
- `ai-docs/DATABASE.md` — how an ingested span becomes a row in the
  `spans` table and what columns are populated.
- `ai-docs/DEVELOPMENT.md` — `RAINDROP_LOCAL_DEBUGGER` write procedure
  and the smoke-test recipe that exercises an end-to-end ingest.
- `ai-docs/PLAN.md` — `F-001` (cloud removal), `F-002` (OpenCode-only
  narrowing), `F-003` (sub-agent visualization), `F-004` (GenAI
  alignment).
