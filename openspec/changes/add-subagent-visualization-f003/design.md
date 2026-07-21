## Context

Workshop today detects sub-agent spans via two patterns in `src/agents.ts`:

- **Pattern 1** — `TOOL_CALL` > `LLM` > `TOOL_CALL` (strict agentic loop)
- **Pattern 2** — `TOOL_CALL` > `LLM(name="agent.subagent")` (Claude Agent SDK convention)

The sub-agent's display `name` is taken from the parent TOOL_CALL span's `span.name` (L113–116). It is **not** read from any `subagent_name` attribute, and there is no special-case for the OpenCode `task` tool. The `SubAgent` interface (`src/agents.ts:25–42`) carries `root_span_id`, `name`, `span_ids[]`, `start`/`end`/`duration_ms`, `model`, `status`, `llm_count`, `tool_count`, `total_input_tokens`, `total_output_tokens` — but no `subagent_name`.

Three copies of `detectSubAgents` exist:
1. `src/agents.ts` (canonical, 130 LOC)
2. `app/src/api/query-api.ts:173` (client-side, identical logic)
3. `app/src/pages/SavedPage.tsx:1052` (client-side, identical logic)

On the UI side:
- `RunDetail.tsx` already renders a focused-agent view (`L1255–1308`) that re-mounts the span tree with `agent.name` as title.
- `RunDetail.tsx` `StatsLine` (`L260`) already shows `sub-agent{count}` via `NumberFlow`.
- `ChatFlow.tsx:72` already renders a `SubAgentBlock` in the Overview tab.
- `SpanTree.tsx` (531 LOC) — **no** special case for `task` tool name, **no** `SubAgentBlock` inside the tree itself, **no** distinct colour for sub-agent root spans.

The spans table has **no** `subagent_name` column; attributes live in a JSON blob on each span.

**Companion-plugin boundary:** the separate repo `~/workspase/projects/opencode-workshop-plugin/` is responsible for emitting `subagent_name` as an OTLP attribute on the LLM child span (via the OpenCode Task tool's `tool.execute.before` hook). That work is plugin F-010 in the plugin repo's PLAN.md. Workshop OpenSpec change ID `opencode-task-subagent-attrs` is reserved per `ai-docs/DEVELOPMENT.md:325`. Until that plugin lands, Workshop must keep working with the parent TOOL_CALL span name as the fallback.

Constraints inherited (per `ai-docs/AGENTS.md` and `ai-docs/HANDOFF.md`):
- Local-only debugger; no cloud deps.
- Single source of truth for features: `ai-docs/PLAN.md`.
- One Feature = one commit (this F-003 = single commit per design decision below).
- Do not edit upstream-owned `Docs/`, root `AGENTS.md`, root `README.md`.

## Goals / Non-Goals

**Goals:**
- Visually distinguish sub-agent root TOOL_CALL spans from generic TOOL_CALL spans inside `SpanTree.tsx`.
- Display a friendly name when the parent span name is `task` (OpenCode Task tool). Read optional `subagent_name` attribute from the LLM child span when present.
- Add a `SubAgentBlock`-style section header inside the Span Tree tab when the run contains at least one sub-agent.
- Consolidate the three `detectSubAgents` copies into one canonical export in `src/agents.ts`.
- Stay forward-compatible: no schema migration required; `subagent_name` rides on the existing `attributes` JSON blob.

**Non-Goals:**
- Persisting `subagent_name` as a first-class column in the `spans` table.
- Implementing the companion plugin's `tool.execute.before` hook (plugin F-010, separate repo).
- Building a span-level filter sidebar (no such component exists; run-level filters already cover what users need).
- Touching the Overview tab's existing `SubAgentBlock`.
- Changing the detection patterns themselves.
- F-004.5 (session tree) — separate change, will consume the canonical `SubAgent` shape from this change.

## Decisions

### D1 — Single-commit implementation, 4 logical units inside one commit. (load-bearing)

The four units (consolidation, naming, badge, in-tree `SubAgentBlock`) are tightly coupled: consolidation produces the typed helper the others consume, and the badge/naming/block all read from the same `SubAgent` shape. Splitting would create intermediate commits where the client-side copies diverge from the canonical helper, or where the badge exists but the in-tree block does not. Single commit per Feature is the fork's convention (see `ai-docs/AGENTS.md`, F-001 precedent with 5 commits for 5 features).

**Alternatives considered:**
- 4 commits inside F-003 — rejected: each intermediate commit would be incomplete (UI referencing a helper that doesn't exist yet, or duplication removed before badge lands).
- 2 commits (consolidation + UI) — rejected: the UI commit's success depends on the helper's exact return shape; one commit makes review atomic.

### D2 — `SubAgent.subagent_name?: string` is optional, read from LLM child's `attributes.subagent_name`. (load-bearing, forward-compatible)

The attribute is populated only by the companion plugin (plugin F-010). Until then, every `SubAgent` will have `subagent_name === undefined`, and the UI falls back to the parent TOOL_CALL span name (today's behaviour). This makes the change non-blocking on the plugin and means the Workshop UI auto-upgrades the moment the plugin starts emitting the attribute — no second Workshop change needed.

**Alternatives considered:**
- Add a `subagent_name` column to `spans` and require the plugin to populate it via OTLP resource attribute — rejected: adds a migration, requires schema coordination across two repos, and the existing `attributes` JSON blob already accommodates arbitrary per-span keys.
- Read the name from a different attribute key (e.g. `agent.name`, `task.description`) — rejected: the reserved OpenSpec change `opencode-task-subagent-attrs` (`ai-docs/DEVELOPMENT.md:325`) fixes the contract as `subagent_name`; picking a different key would force the plugin to emit two.

### D3 — Friendly label for `task` tool roots: display `Sub-agent` (capitalised) instead of the raw `task` name, with the sub-agent name appended when available. (reversible)

When the parent TOOL_CALL span's name is exactly `task`, the row label becomes `Sub-agent: {subagent_name || 'task N'}` where N is the 1-based index of the sub-agent inside the run. Non-`task` parent spans (e.g. `mcp__foo__bar` tools that happen to be detected as sub-agent roots via Pattern 1) keep their original span name verbatim, appended with the same `: {subagent_name}` suffix when available.

This is a pure presentation tweak; reversal is one line.

**Alternatives considered:**
- Show the raw `task` name everywhere — rejected: the PLAN.md F-003 motivation explicitly calls for friendlier rendering.
- Use the OpenCode Task tool's `description` argument as the display name (parsed from the TOOL_CALL span's input) — rejected for this change: that would duplicate the plugin's `tool.execute.before` job client-side, and the description argument is not always present.

### D4 — Distinct colour for sub-agent root TOOL_CALL spans: warm gold (`#d4a857`), distinct from the existing TOOL_CALL brown (`#b08c5a`). (reversible)

Today `TYPE_LABEL.TOOL_CALL = #b08c5a` for every tool span (`SpanTree.tsx:46`). Sub-agent roots get a new entry `TYPE_LABEL.SUB_AGENT_ROOT = #d4a857`. The colour is added to the `TYPE_LABEL` map and selected in `inferSpanTypeForDisplay` (a new local helper in `SpanTree.tsx`, NOT to be confused with `src/parse.ts:35` `inferSpanType` which stays INTERNAL-only for span normalisation).

The same colour is reused in `FlameTimeline.tsx` tooltip badges for visual consistency across tabs.

**Alternatives considered:**
- Reuse TRACE purple (`#A57CF5`) — rejected: TRACE marks run roots, conflating the two would confuse users.
- Add a chevron/indent style instead of a colour — rejected: indent already exists (depth × 14 + 8), and colour is a stronger signal at a glance.

### D5 — Consolidation target: `src/agents.ts` exports `detectSubAgents(spans: NormalizedSpan[]): SubAgent[]` plus `isSubAgentRootSpan(span, subAgents): boolean`. The two client-side copies import from a re-export at `app/src/api/agents.ts` to avoid a deep relative path. (load-bearing)

`src/agents.ts` is server-side; `app/src/api/agents.ts` is a thin re-export shim that the React side already uses for other server-typed helpers. This keeps the import paths clean and the source of truth in one file.

**Alternatives considered:**
- Move `detectSubAgents` to a shared `shared/` directory — rejected: no such directory exists in the repo, and the convention is `src/` for server, `app/src/` for client, with re-exports as needed.
- Keep three copies but extract a shared JSON-shape validator — rejected: the audit shows the three bodies are already byte-equivalent; the only sensible target is one function, not three plus a validator.

## Risks / Trade-offs

- **Risk:** Plugin F-010 changes the `subagent_name` contract (different key, nested path) → Workshop's friendly-name fallback silently stops working. **Mitigation:** the contract is pinned by the reserved OpenSpec change `opencode-task-subagent-attrs` in `ai-docs/DEVELOPMENT.md:325`. Any change to that contract must update both repos. Document this coupling in F-003 tasks.md verification step.
- **Risk:** Consolidating `detectSubAgents` introduces a regression in one of the three call-sites (e.g. SavedPage passes a different span shape). **Mitigation:** the three copies are byte-equivalent per audit; tests in `app/tests-e2e/workshop-actions.spec.ts` cover sub-agent count and focused-agent view; new e2e assertions for the badge and in-tree block are added in this change.
- **Risk:** The new `SUB_AGENT_ROOT` colour clashes with F-004's palette work (F-004.2 unifies palettes across `SpanTree.tsx` and `FlameTimeline.tsx`). **Mitigation:** F-004.2 will absorb the new entry into its unified palette; the colour value is a placeholder that F-004.2 may revise. Coordinate via commit order (F-003 first, F-004 second).
- **Trade-off:** Single-commit design makes the diff larger (~150 LOC) but keeps F-003 atomic. This matches the fork's "one Feature = one commit" rule but means reviewers cannot bisect inside F-003.

## Migration Plan

No data migration. Pure code change. Rollback = revert the single commit. No daemon restart required for the change to take effect on next `bun run dev`, but the user's standing rule "never restart the daemon without explicit OK" applies.

## Open Questions

- Should the in-tree `SubAgentBlock` collapse the sub-agent's spans by default, or only on user click? **Default proposal:** start expanded (matches today's tree behaviour), add a collapse toggle as a follow-up under F-004.1 (nested tree + expand/collapse). F-003 ships the badge and the block header; F-004.1 ships the collapse interaction.
- Should the friendly-name logic for `task` tool roots also apply to runs imported via `/api/ingest` from non-OpenCode agents (e.g. Claude Agent SDK traces that already follow Pattern 2)? **Default proposal:** yes — Pattern 2 detection already fires for those traces, and the friendly label is a pure presentation improvement. No special-casing by provider.
