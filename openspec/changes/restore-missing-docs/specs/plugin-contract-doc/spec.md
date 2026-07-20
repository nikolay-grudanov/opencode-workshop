## ADDED Requirements

### Requirement: OTLP ingest endpoint contract

The `ai-docs/PLUGIN-CONTRACT.md` document SHALL specify the exact ingest endpoint (path, HTTP method, accepted `Content-Type` values — including protobuf and JSON variants), the request body shape, the response codes, and the daemon base URL (`http://localhost:5899` by default). The contract MUST match what `src/parse.ts` and `src/otlp-protobuf.ts` accept at the time the doc is written, with line citations.

#### Scenario: Plugin author implementing trace publishing

- **WHEN** a plugin author writes code to publish a span to the daemon
- **THEN** the contract specifies the URL, headers, body encoding, and success response, so the author can implement against the doc alone

### Requirement: Span shape contract

The document SHALL describe the span shape the plugin must emit, derived from `src/spans/normalize.ts`. It MUST document: required fields (`traceId`, `spanId`, `parentSpanId`, `name`, `kind`, `startTime`, `endTime`, `status`), optional fields (`attributes`, `events`, `resource`), the values expected for `span.kind` (LLM, TOOL, CHAIN, RETRIEVER, EMBEDDING, etc.), and the conventions for OpenCode-specific spans (`task` tool sub-agent invocations).

#### Scenario: Plugin emitting a sub-agent span

- **WHEN** the plugin emits a span representing an OpenCode `task` sub-agent invocation
- **THEN** the contract documents the required `attributes` keys (e.g. `subagent_name`, `description`) so Workshop's `src/agents.ts` can detect and name the sub-agent correctly

### Requirement: Environment variable contract

The document SHALL list every env var the plugin MUST set or respect, with the exact variable name, expected value, and purpose. MUST include at minimum: `RAINDROP_LOCAL_DEBUGGER` (URL the plugin publishes to), and any other env vars present in `src/parse.ts` / `src/server.ts` that affect plugin behavior.

#### Scenario: Plugin author configuring the daemon URL

- **WHEN** a plugin author needs to point the plugin at a non-default daemon port
- **THEN** the contract documents `RAINDROP_LOCAL_DEBUGGER=http://localhost:<port>` so the author can override the default

### Requirement: Sub-agent metadata expectation

The document SHALL describe what metadata the daemon expects for OpenCode `task` tool sub-agents, and how `src/agents.ts` uses it. The expected attributes MUST cover at least: a name/description attribute used as the sub-agent label, and any parent-child linkage fields used to build the sub-agent tree. The doc MUST forward-reference F-003 (`ai-docs/PLAN.md` Sub-agent visualization) as the future UI improvement.

#### Scenario: Plugin author adding sub-agent metadata

- **WHEN** a plugin author is adding metadata for `task` tool spans
- **THEN** the contract lists the exact attribute keys Workshop reads, so the plugin emits spans that render with names instead of "tool: task"

### Requirement: Versioning and stability statement

The document SHALL include a "Stability" section stating which parts of the contract are stable (ingest endpoint URL, required span fields) vs in-flux (sub-agent attribute names pending F-003). It MUST instruct plugin authors to check this doc on every release of either repo before assuming compatibility.

#### Scenario: Plugin author upgrading Workshop

- **WHEN** the daemon is upgraded and the plugin author wants to know if anything broke
- **THEN** the stability section tells them which contract parts to re-test, instead of relying on tribal knowledge
