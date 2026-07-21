## ADDED Requirements

### Requirement: Span tree SHALL visually distinguish sub-agent root TOOL_CALL spans from generic TOOL_CALL spans

The Span Tree tab in `RunDetail.tsx` SHALL render sub-agent root spans (TOOL_CALL spans whose children contain at least one LLM span, as detected by `detectSubAgents` in `src/agents.ts`) using a distinct type label colour — `SUB_AGENT_ROOT = #d4a857` — that differs from the existing `TOOL_CALL = #b08c5a`. The colour selection is performed by a local helper inside `SpanTree.tsx` (`inferSpanTypeForDisplay`) and SHALL NOT modify the server-side `inferSpanType` in `src/parse.ts`.

#### Scenario: Sub-agent root span shows distinct badge colour

- **WHEN** a run contains a sub-agent (TOOL_CALL > LLM > TOOL_CALL or TOOL_CALL > LLM with name `agent.subagent`)
- **AND** the user opens the Span Tree tab for that run
- **THEN** the row for the sub-agent root TOOL_CALL span renders with a coloured badge using `#d4a857`, distinct from generic TOOL_CALL rows which use `#b08c5a`

#### Scenario: Generic tool span colour unchanged

- **WHEN** a run contains a TOOL_CALL span that is not a sub-agent root (e.g. `mcp__foo__bar` whose children are not LLM spans)
- **THEN** that span's row badge uses the existing `#b08c5a` TOOL_CALL colour, unchanged by this change

#### Scenario: Flame Timeline tooltip mirrors SpanTree colour

- **WHEN** the user hovers a sub-agent root TOOL_CALL span in the Flame Timeline (`FlameTimeline.tsx`)
- **THEN** the tooltip badge for that span uses the same `#d4a857` colour as the Span Tree tab

### Requirement: Span tree SHALL display a friendly name for `task` tool sub-agent roots

When the sub-agent root TOOL_CALL span's name is exactly `task` (the OpenCode Task tool convention), the Span Tree row label SHALL be `Sub-agent: {displayName}` where `{displayName}` is, in order of preference: (1) the LLM child span's `attributes.subagent_name` if present, (2) `task {N}` where N is the 1-based sub-agent index inside the run. For non-`task` parent span names, the row label SHALL be `{span.name}: {displayName}` with the same preference order, falling back to omitting the suffix when no `subagent_name` attribute is present.

#### Scenario: task tool with no subagent_name attribute

- **WHEN** a sub-agent root TOOL_CALL span has `span.name === "task"`
- **AND** its LLM child span has no `attributes.subagent_name`
- **AND** it is the first sub-agent detected in the run
- **THEN** the Span Tree row label displays `Sub-agent: task 1`

#### Scenario: task tool with subagent_name attribute populated by plugin

- **WHEN** a sub-agent root TOOL_CALL span has `span.name === "task"`
- **AND** its LLM child span has `attributes.subagent_name === "research-helper"`
- **THEN** the Span Tree row label displays `Sub-agent: research-helper`

#### Scenario: Non-task parent tool name preserves the raw span name

- **WHEN** a sub-agent root TOOL_CALL span has `span.name === "mcp__custom__delegate"` (Pattern 1 detection)
- **AND** no `subagent_name` attribute is present
- **THEN** the Span Tree row label displays `mcp__custom__delegate` verbatim, with no suffix

### Requirement: Span Tree tab SHALL render an in-tree SubAgentBlock section header when the run contains sub-agents

When `detectSubAgents` returns at least one `SubAgent` for the current run, the Span Tree tab SHALL render a `SubAgentBlock`-style section header (mirroring the existing `SubAgentBlock` shown in the Overview tab at `app/src/components/ChatFlow.tsx:72`) above the affected portion of the tree, listing each sub-agent's display name, model, span count and status. The Overview tab's existing `SubAgentBlock` SHALL remain unchanged.

#### Scenario: Run with no sub-agents shows no in-tree block

- **WHEN** a run contains zero sub-agents
- **THEN** the Span Tree tab renders no `SubAgentBlock` section header

#### Scenario: Run with two sub-agents shows both in tree

- **WHEN** a run contains two sub-agents (e.g. `task 1` and `task 2`)
- **THEN** the Span Tree tab renders a `SubAgentBlock` section header listing both sub-agents with their display name, model, span count and status

#### Scenario: Overview tab SubAgentBlock unchanged

- **WHEN** the user opens the Overview tab for a run with sub-agents
- **THEN** the existing `SubAgentBlock` (ChatFlow.tsx:72) renders as before, with no behaviour change

### Requirement: `detectSubAgents` SHALL have exactly one canonical implementation imported by all call-sites

The `detectSubAgents` function SHALL exist in exactly one location — `src/agents.ts` — and SHALL be imported by every consumer. The two client-side copies at `app/src/api/query-api.ts:173` and `app/src/pages/SavedPage.tsx:1052` SHALL be replaced with imports from a re-export shim at `app/src/api/agents.ts`. After this change, `rg -n 'function detectSubAgents|const detectSubAgents' src/ app/` SHALL return exactly one match: the definition in `src/agents.ts`.

#### Scenario: Single canonical definition

- **WHEN** the codebase is searched for `detectSubAgents` definitions after this change
- **THEN** exactly one match exists, located in `src/agents.ts`

#### Scenario: Client-side call-sites import from re-export

- **WHEN** the user inspects `app/src/api/query-api.ts` and `app/src/pages/SavedPage.tsx` after this change
- **THEN** both files import `detectSubAgents` (and any related helpers) from `app/src/api/agents.ts`, which in turn re-exports from `src/agents.ts`

#### Scenario: Behaviour parity for existing consumers

- **WHEN** the user loads a run with sub-agents after this change
- **THEN** the run list (`RunsPage.tsx`), the focused-agent view (`RunDetail.tsx:1255`), and the Saved page (`SavedPage.tsx`) display the same sub-agent count and names as before the consolidation

### Requirement: `SubAgent` interface SHALL include an optional `subagent_name` field populated from the LLM child span's attributes

The `SubAgent` interface in `src/agents.ts:25–42` SHALL be extended with `subagent_name?: string`. When the LLM child span's `attributes.subagent_name` is a non-empty string, `detectSubAgents` SHALL copy it onto the returned `SubAgent`. When the attribute is absent or empty, `subagent_name` SHALL be `undefined`, and consumers SHALL fall back to the existing parent TOOL_CALL span name behaviour.

#### Scenario: subagent_name present on LLM child

- **WHEN** a sub-agent's LLM child span has `attributes.subagent_name === "research-helper"`
- **THEN** the corresponding `SubAgent.subagent_name === "research-helper"`

#### Scenario: subagent_name absent on LLM child

- **WHEN** a sub-agent's LLM child span has no `attributes.subagent_name` (or the value is empty)
- **THEN** the corresponding `SubAgent.subagent_name === undefined`

#### Scenario: No schema migration required

- **WHEN** the daemon starts after this change
- **THEN** no SQLite migration runs; the `spans` table schema is unchanged; `subagent_name` is read exclusively from the existing `attributes` JSON blob
