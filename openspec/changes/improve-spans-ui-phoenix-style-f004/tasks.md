# Tasks: improve-spans-ui-phoenix-style-f004

Implementation checklist for F-004. Decomposed into 5 commit groups (F-004.1
through F-004.5) per design D1. Commit order: F-004.2 → F-004.1 → F-004.3 →
F-004.4 → F-004.5. Each commit body references `Refs F-004.`.

**F-004.5 dependency:** must land AFTER F-003 (canonical `SubAgent` shape) is
merged. F-004.1..F-004.4 do not depend on F-003.

Verification rules (apply to every task):
- `bun run build` MUST succeed after each commit.
- `bun run lint` MUST be clean after each commit.
- `bun x tsc --noEmit` MUST pass after each commit.
- No `git push` — local commits only, push requires explicit user instruction.

Reference paths (see `proposal.md`, `design.md`, `specs/phoenix-spans-ui/spec.md`).

---

## 1. Commit 1 — F-004.2: Unified palette + extended span types

- [x] 1.1 Create new module `app/src/utils/span-colors.ts` exporting `SPAN_TYPE_COLORS: Record<SpanType, string>` and `spanColor(type: SpanType): string`. Cover at minimum `TRACE`, `LLM_GENERATION`, `TOOL_CALL`, `AGENT_ROOT`, `INTERNAL`, `CHAIN`, `RETRIEVER`, `EMBEDDING`, `SUB_AGENT_ROOT` (the last entry comes from F-003's palette value `#d4a857`)
- [x] 1.2 In `src/parse.ts:35–41` `inferSpanType`, extend the return type to include `"CHAIN" | "RETRIEVER" | "EMBEDDING"`. Add inference logic that detects: `gen_ai.span.kind` attribute values of `"chain"`/`"retriever"`, and `span.name` containing "chain"/"retriever"/"embedding" (case-insensitive). Preserve today's `INTERNAL` fallback for everything else
- [x] 1.3 In `app/src/utils/types.ts`, extend the `SpanType` (or whatever the inferred-type union is named) to include `"CHAIN" | "RETRIEVER" | "EMBEDDING"`
- [x] 1.4 In `app/src/components/SpanTree.tsx:44–49`, remove the local `TYPE_LABEL` map; replace all `TYPE_LABEL[...]` lookups with `spanColor(spanType)` from the new module
- [x] 1.5 In `app/src/components/FlameTimeline.tsx`, in the tooltip-badge render branch (around `L7–12`) and the per-name colour assignment (around `L328–360`), replace colour resolution with `spanColor(spanType)` from the new module
- [x] 1.6 In `app/src/utils/colors.ts:27–37`, remove the per-name rotating palette; keep only generic UI colours used elsewhere (if any)
- [x] 1.7 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 1.8 Verify: `rg -n 'TYPE_LABEL|rotating.*palette' app/src/components/SpanTree.tsx app/src/components/FlameTimeline.tsx app/src/utils/colors.ts` returns 0 matches in those files
- [x] 1.9 Smoke test: open a run in Span Tree and in Flame Timeline; confirm a TOOL_CALL span renders the same colour in both tabs
- [x] 1.10 Commit with message `feat: unify span colour palette across SpanTree and FlameTimeline` (body: `Refs F-004. Extends inferSpanType to surface CHAIN/RETRIEVER/EMBEDDING.`)

## 2. Commit 2 — F-004.1: Nested tree with chevrons and child-count badges

- [x] 2.1 In `app/src/components/SpanTree.tsx`, replace the flat DOM rendering (around `L86` where `paddingLeft: depth * 14 + 8` is applied) with a nested DOM that emits child rows inside the parent row's element. Use a recursive `<Row>` sub-component
- [x] 2.2 Add a `useState<Map<string, boolean>>` for expand/collapse state, seeded with all `true`
- [x] 2.3 Add chevron rendering: rows with children render `▸` (collapsed) or `▾` (expanded) preceding the type badge; rows without children render no chevron
- [x] 2.4 Add click handler on the chevron that toggles the entry in the state map
- [x] 2.5 Add a `useEffect` keyed on `runId` that resets the state map to all-`true` when the user switches runs
- [x] 2.6 Add a child-count badge that renders `children.get(span.id)?.length` after the type badge when count > 0
- [x] 2.7 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 2.8 Verify: `bun run dev` boots cleanly and the Span Tree tab renders nested DOM with chevrons on rows that have children (smoke only — do NOT restart daemon without explicit user OK)
- [x] 2.9 Smoke test: click a chevron and confirm the subtree collapses; click again and confirm it expands; navigate to a different run and confirm all branches are expanded on the new run
- [x] 2.10 Commit with message `feat: render SpanTree as nested DOM with chevrons and child-count badges` (body: `Refs F-004.`)

## 3. Commit 3 — F-004.3: Info tab inside SpanDetail with role palette

- [x] 3.1 In `app/src/components/SpanDetail.tsx`, add internal tab state (`"messages" | "metadata"`) via `useState`. Render a small tab strip above the existing content
- [x] 3.2 When the active span's inferred type is `LLM_GENERATION`, render both `Messages` and `Metadata` tabs; for all other inferred types, render only the `Metadata` tab
- [x] 3.3 Default active tab: `Messages` for LLM spans, `Metadata` for everything else
- [x] 3.4 In the `Messages` tab, render the span's messages via `MessageList` and `messageParsing.ts`. Read messages from `span.normalized.messages` (the same path used by `extractContext()` in `src/replay.ts:44–74`)
- [x] 3.5 In the `Metadata` tab, render the existing metadata + provider options + raw input/output `JsonView` (unchanged content, just moved into a tab panel)
- [x] 3.6 In `app/src/components/MessageList.tsx:8–13`, update role styles to use a distinct palette: `system` navy, `user` cool gray, `assistant` warm orange, `tool` neutral (current)
- [x] 3.7 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 3.8 Smoke test: click an LLM_GENERATION span and confirm the `Messages` tab is active with messages rendered; switch to `Metadata` and confirm existing fields are present; click a TOOL_CALL span and confirm only `Metadata` is rendered (no `Messages` tab visible)
- [x] 3.9 Commit with message `feat: tabbed SpanDetail with role-specific message palette` (body: `Refs F-004.`)

## 4. Commit 4 — F-004.4: Flat/Nested view-mode toggle with localStorage persistence

- [x] 4.1 In `app/src/components/RunDetail.tsx`, between the tab strip (`L1363`) and the active renderer (`L1364`), add a small `Flat | Nested` toggle component. Use a simple two-button group; track active state via `useState`
- [x] 4.2 Add localStorage persistence under `workshop.spanViewMode` with values `"flat"` or `"nested"`. Read once on mount with defensive parsing (malformed JSON → `"nested"`); write immediately on toggle
- [x] 4.3 Pass the current mode as a prop (`viewMode: "flat" | "nested"`) to `SpanTree.tsx` and `FlameTimeline.tsx`
- [x] 4.4 In `SpanTree.tsx`, when `viewMode === "flat"`, render the legacy flat depth-first list (no nested DOM, no chevrons); when `viewMode === "nested"`, render the new nested DOM from F-004.1
- [x] 4.5 In `FlameTimeline.tsx`, when `viewMode === "flat"`, render the legacy grouping (by span name); when `viewMode === "nested"`, group by `parent_span_id` (note: this is a subset of F-004.5's full session tree — flame timeline grouping, not the dedicated tab)
- [x] 4.6 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 4.7 Verify: `rg -n 'localStorage' app/src/components/RunDetail.tsx` returns the new `workshop.spanViewMode` read/write only (no other localStorage keys added)
- [x] 4.8 Smoke test: select `Flat`, reload, confirm `Flat` is restored; select `Nested`, reload, confirm `Nested` is restored; in each mode, confirm `SpanTree` and `FlameTimeline` honour the choice
- [x] 4.9 Commit with message `feat: Flat/Nested view-mode toggle with localStorage persistence` (body: `Refs F-004.`)

## 5. Commit 5 — F-004.5: Session tree tab

- [x] 5.1 In `app/src/utils/navigation.ts:28–35`, extend the `RunView` enum with `"session"` (add to the union type)
- [x] 5.2 In `app/src/router.tsx:101–105`, add a route `<Route path="/runs/:runId/session" element={<RunDetail />} />` (or whatever the route-element convention is in this file)
- [x] 5.3 In `app/src/components/RunDetail.tsx:1357–1362`, add a new tab labelled `Session` between `Span Tree` and `Convo` in the tab strip
- [x] 5.4 In `app/src/components/RunDetail.tsx`, render the `Session` renderer when `view === "session"`. The renderer:
  - Builds a `Map<span_id, Span[]>` from `parent_span_id`
  - Builds a `Map<span_id, SubAgent>` from `subAgents` keyed by `root_span_id`
  - Recursively renders the tree starting from spans whose `parent_span_id` is null
  - For each top-level sub-agent root, renders a group header using `SubAgent` (display name, model, span count, status) — fallback to parent TOOL_CALL span name when `subagent_name` is absent
- [x] 5.5 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 5.6 Smoke test: open a run with sub-agents; click `Session` tab; confirm the tree groups by parent/child and sub-agent roots are labelled with their display name; navigate to `/runs/:id/session` directly via URL and confirm the tab is selected
- [x] 5.7 Verify: `rg -n 'RunView|"/runs/:runId/session"' app/src/utils/navigation.ts app/src/router.tsx app/src/components/RunDetail.tsx` returns expected new entries
- [x] 5.8 Commit with message `feat: Session tree tab grouping spans by parent/child` (body: `Refs F-004. Closes F-004. Depends on F-003 canonical SubAgent shape.`)

