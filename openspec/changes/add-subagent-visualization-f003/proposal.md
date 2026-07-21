## Why

Workshop already detects sub-agent spans (pattern: TOOL_CALL > LLM > TOOL_CALL, or TOOL_CALL > LLM named `agent.subagent`) and surfaces a count in the runs list and an agent-focused view in `RunDetail.tsx`. But the span tree itself — the primary surface for inspecting a run — does not visually distinguish sub-agent boundaries, does not show the sub-agent's name on its root span, and does not let the user expand/collapse a sub-agent's sub-tree as a unit. Users tracing a multi-agent run have to read span names one-by-one to spot where one agent ends and another begins.

This closes that gap. Companion plugin work (separate repo, planned as plugin F-010) will emit `subagent_name` as an OTLP attribute via a `tool.execute.before` hook; this change makes Workshop ready to consume it and to render sub-agent structure even before the plugin lands (using today's detection contract: parent TOOL_CALL span name).

F-003 in `ai-docs/PLAN.md` (L123–143) tracks this feature.

## What Changes

- **Visual** — mark sub-agent root spans (TOOL_CALL whose children include an LLM) in `SpanTree.tsx` with a distinct type label and colour, distinct from generic TOOL_CALL spans.
- **Naming** — when a sub-agent root TOOL_CALL span's name matches `task` (the OpenCode Task tool convention), display a friendlier label on the span row. When the `subagent_name` attribute is present on the LLM child (plugin F-010 contract), prefer it as the displayed name. Fall back to the parent TOOL_CALL span name.
- **Grouping** — add a `SubAgentBlock`-style section header inside `SpanTree.tsx` when the tree contains at least one detected sub-agent, listing the sub-agent name, model, span count and status. This mirrors the existing `SubAgentBlock` already shown in the Overview tab (`app/src/components/ChatFlow.tsx:72`).
- **Detection consolidation** — collapse the three copies of `detectSubAgents` (`src/agents.ts`, `app/src/api/query-api.ts:173`, `app/src/pages/SavedPage.tsx:1052`) into one canonical implementation in `src/agents.ts`, exporting typed helpers that the other two sites import.
- **Schema (additive)** — extend `SubAgent` interface in `src/agents.ts:25–42` with an optional `subagent_name?: string` field read from the LLM child's `attributes.subagent_name`. This is forward-compatible: absent today, populated once plugin F-010 ships.
- **Companion-side work (separate repo)** — out of scope for this change body; tracked as plugin F-010 in `~/workspase/projects/opencode-workshop-plugin/`. Workshop OpenSpec change ID `opencode-task-subagent-attrs` is reserved per `ai-docs/DEVELOPMENT.md:325` and will be implemented there.

### Scope

Files in scope:
- `src/agents.ts` — canonical `detectSubAgents`, `SubAgent` interface extension
- `app/src/api/query-api.ts:173` — replace local copy with import from `src/agents.ts`
- `app/src/pages/SavedPage.tsx:1052` — replace local copy with import from `src/agents.ts`
- `app/src/components/SpanTree.tsx` — type label colour, `task`-tool friendly label, optional `SubAgentBlock` section header inside the tree
- `app/src/components/ChatFlow.tsx:72` — leave existing `SubAgentBlock` in Overview tab untouched (no behaviour change); optionally have it consume the same canonical helper
- `app/src/components/RunDetail.tsx` — no changes required (focused-agent view at L1255–1308 already works; only its data source becomes canonical)

### Scope OUT

- Backend persistence of `subagent_name` as a first-class column in `spans` table. The attribute lives in the existing `attributes` JSON blob; no migration. (Plugin F-010 will populate the blob.)
- The companion plugin itself (`~/workspase/projects/opencode-workshop-plugin/`). That repo is responsible for emitting the `subagent_name` attribute via the OpenCode Task tool's `tool.execute.before` hook. Plugin-side work is tracked as plugin F-010 in that repo's PLAN.md.
- Any change to the Overview tab's existing `SubAgentBlock` rendering. This change adds an analogous block inside the Span Tree tab only.
- Any new "filter sidebar" component — `PLAN.md` mentions one, but no such component exists in the codebase and the existing Run/agent filters (`RunsPage.tsx:54` agentFilter chip, `SearchPage.tsx:593` FilterKey) already cover run-level filtering. Workshop does not need a span-level filter sidebar.
- Changes to `src/agents.ts` detection patterns themselves (Pattern 1 and Pattern 2 from the audit are kept as-is; only the `name` extraction may read a new optional attribute).
- F-004 (`improve-spans-ui-phoenix-style`) — separate change. F-004.5 (session tree) will consume the canonical `SubAgent` shape produced here, but is implemented in its own change.

## Capabilities

### New Capabilities
- `subagent-span-tree-viz`: Visual and structural rendering of detected sub-agents inside the Span Tree tab — type label colouring, friendly naming for `task` tool roots, optional `SubAgentBlock` header inside the tree, and a consolidated `detectSubAgents` helper used by all three existing call-sites.

### Modified Capabilities
- (none — `subagent-span-tree-viz` is a brand-new capability; there is no pre-existing spec to delta)

## Impact

- **Code surface:** `+80` to `+150` net LOC in 6–8 files (per audit). No deletions of behaviour; the three `detectSubAgents` copies collapse into one (~40 LOC net reduction in duplication).
- **API:** `/api/runs/detail/:id` response already returns `subAgents[]`; this change does not alter the response shape, only the producer of that field on the client side.
- **Schema:** no migration required. `subagent_name` rides on the existing `attributes` JSON blob on the LLM child span.
- **Companion plugin:** blocks nothing. Until plugin F-010 lands, Workshop falls back to the parent TOOL_CALL span name (today's behaviour). Once the plugin emits `subagent_name`, the UI shows it without further change.
- **Tests:** Playwright e2e (`app/tests-e2e/workshop-actions.spec.ts`) gains assertions that: (1) a sub-agent root span shows a distinct badge; (2) the `task` tool label is friendly; (3) collapsing a sub-agent hides its descendants. Existing assertions continue to pass.
- **Docs:** `ai-docs/PLAN.md` F-003 (L123–143) marked done on merge. Plugin-side F-010 doc is updated separately in the plugin repo.
