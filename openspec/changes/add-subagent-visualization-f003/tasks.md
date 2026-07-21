# Tasks: add-subagent-visualization-f003

Implementation checklist for F-003. Single commit per design D1 (one Feature =
one commit, fork convention). The four logical units (consolidation, naming,
badge, in-tree `SubAgentBlock`) ship together because each depends on the
others' data shape.

Verification rules (apply to every task):
- `bun run build` MUST succeed after the commit.
- `bun run lint` MUST be clean after the commit.
- `bun x tsc --noEmit` MUST pass after the commit.
- No `git push` — local commit only, push requires explicit user instruction.

Reference paths (see `proposal.md`, `design.md`, `specs/subagent-span-tree-viz/spec.md`):
- MODIFY `src/agents.ts` — canonical `detectSubAgents`, extend `SubAgent` interface
- CREATE `app/src/api/agents.ts` — thin re-export shim
- MODIFY `app/src/api/query-api.ts:173` — replace local copy with import
- MODIFY `app/src/pages/SavedPage.tsx:1052` — replace local copy with import
- MODIFY `app/src/components/SpanTree.tsx` — type label colour, friendly label, in-tree `SubAgentBlock`
- MODIFY `app/src/components/FlameTimeline.tsx` — tooltip badge colour consistency

---

## 1. Consolidate `detectSubAgents` to single canonical implementation

- [x] 1.1 Confirm `detectSubAgents` in `src/agents.ts` (130 LOC, audit-verified byte-equivalent to the two client copies) is the canonical signature: `function detectSubAgents(spans: NormalizedSpan[]): SubAgent[]`
- [x] 1.2 Create re-export shim at `app/src/api/agents.ts` that re-exports `detectSubAgents` (and any helpers used by the two client sites, e.g. `isSubAgentRootSpan`) from `src/agents.ts`
- [x] 1.3 In `app/src/api/query-api.ts:173`, replace the local `detectSubAgents` definition with `import { detectSubAgents } from "./agents"`
- [x] 1.4 In `app/src/pages/SavedPage.tsx:1052`, replace the local `detectSubAgents` definition with `import { detectSubAgents } from "../api/agents"`
- [x] 1.5 Verify: `rg -n 'function detectSubAgents|const detectSubAgents' src/ app/` returns exactly one match in `src/agents.ts`
- [x] 1.6 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed

## 2. Extend `SubAgent` interface with optional `subagent_name`

- [x] 2.1 In `src/agents.ts:25–42`, add `subagent_name?: string` to the `SubAgent` interface (placed after `name` for readability)
- [x] 2.2 In `src/agents.ts:detectSubAgents`, when iterating the LLM child span for each detected sub-agent, read `attributes.subagent_name` and copy it onto the returned `SubAgent` when it is a non-empty string; otherwise leave `subagent_name` undefined
- [x] 2.3 Verify: `bun x tsc --noEmit` succeeds (additive type change must not break existing consumers)
- [x] 2.4 Verify: `rg -n 'subagent_name' src/agents.ts app/src/api/agents.ts` returns expected definition + re-export

## 3. Add `SUB_AGENT_ROOT` colour and badge to SpanTree

- [x] 3.1 In `app/src/components/SpanTree.tsx:44–49` (`TYPE_LABEL` map), add a new entry `SUB_AGENT_ROOT: "#d4a857"` alongside the existing entries
- [x] 3.2 In `app/src/components/SpanTree.tsx`, add a local helper `function inferSpanTypeForDisplay(span, subAgents): TYPE_LABEL_KEY` that returns `SUB_AGENT_ROOT` when `subAgents.some(s => s.root_span_id === span.id)`; otherwise returns the existing display type (TRACE / TOOL_CALL / LLM_GENERATION / INTERNAL)
- [x] 3.3 In the row-rendering JSX (around L86 where indentation is set), replace the `TYPE_LABEL[...]` lookup with the new helper so sub-agent root spans get `#d4a857` badge colour
- [x] 3.4 Verify: `bun run build && bun x tsc --noEmit` succeed
- [ ] 3.5 Smoke test: load a run containing a sub-agent (e.g. one of the demo traces with a TOOL_CALL > LLM > TOOL_CALL pattern) and confirm visually that the sub-agent root span row shows a gold badge distinct from generic TOOL_CALL rows

## 4. Friendly name for `task` tool sub-agent roots

- [x] 4.1 In `app/src/components/SpanTree.tsx`, in the row-label render branch (around L130–139 where `span.name` is shown verbatim), detect `span.name === "task"` AND `subAgents.some(s => s.root_span_id === span.id)`
- [x] 4.2 When the condition is true, replace the raw `span.name` display with `Sub-agent: {subagent_name ?? \`task ${index}\`}` where `index` is the 1-based index of the sub-agent in the run's `subAgents[]` array
- [x] 4.3 For non-`task` sub-agent parent names (Pattern 1 detection via e.g. `mcp__custom__delegate`), display `{span.name}: {subagent_name ?? ''}` with the suffix omitted when `subagent_name` is absent
- [x] 4.4 Verify: `bun x tsc --noEmit` succeeds
- [ ] 4.5 Smoke test: load a run with a `task`-tool sub-agent root — confirm the row reads `Sub-agent: {name or "task 1"}`

## 5. In-tree `SubAgentBlock` section header

- [x] 5.1 In `app/src/components/SpanTree.tsx`, add a conditional section above the tree's flat span list: when `subAgents.length > 0`, render a `SubAgentBlock`-style component listing each sub-agent's display name, model, span count and status (mirrors `app/src/components/ChatFlow.tsx:72` in structure but lives inside the tree)
- [x] 5.2 Extract the existing `SubAgentBlock` rendering in `app/src/components/ChatFlow.tsx:72` into a shared component (e.g. `app/src/components/SubAgentBlock.tsx`) so both the Overview tab and the new in-tree header consume the same component, ensuring identical presentation
- [x] 5.3 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [ ] 5.4 Smoke test: load a run with two sub-agents and confirm the in-tree `SubAgentBlock` lists both with correct model/span count/status; load a run with zero sub-agents and confirm no block renders

## 6. Mirror colour in Flame Timeline tooltip

- [x] 6.1 In `app/src/components/FlameTimeline.tsx`, in the tooltip-badge render branch (around L7–12 where per-span badge colour is computed), when the hovered span is a sub-agent root (resolved via the same `subAgents` lookup as D4), apply `#d4a857` instead of the per-name rotating palette colour
- [x] 6.2 Verify: `bun x tsc --noEmit` succeeds
- [ ] 6.3 Smoke test: hover a sub-agent root span in the Flame Timeline tooltip — confirm the badge colour matches the Span Tree tab

## 7. End-to-end verification and commit

- [x] 7.1 Extend `app/tests-e2e/workshop-actions.spec.ts` with three new assertions:
  - Sub-agent root span shows `#d4a857` badge colour (assert via `getComputedStyle`)
  - `task` tool label renders as `Sub-agent: ...` (assert via DOM text)
  - In-tree `SubAgentBlock` is visible when sub-agents exist, absent when they don't
- [x] 7.2 Run `bun run test` (or the e2e harness per repo convention) and confirm all assertions pass
- [x] 7.3 Run `bun run build && bun run lint && bun x tsc --noEmit` — all three MUST succeed
- [x] 7.4 Final grep: `rg -n 'function detectSubAgents' src/ app/` — exactly one match in `src/agents.ts`
- [x] 7.5 Final grep: `rg -n 'function isSubAgentRootSpan' src/ app/` — exactly one match in `src/agents.ts` (or absent if helper was inlined; the spec requires exactly one definition regardless of name)
- [ ] 7.6 Smoke: `bun run dev` boots cleanly (smoke only — do NOT restart daemon without explicit user OK)
- [x] 7.7 Commit with message `feat: visualise sub-agents in Span Tree` (body: `Refs F-003. Consolidates detectSubAgents across 3 sites; adds friendly task-tool labelling and in-tree SubAgentBlock.`)
