## Why

The Span Tree tab is Workshop's primary surface for inspecting a single run, but it has accumulated UX gaps that make multi-agent, multi-modal runs harder to read than they should be:

- **Flat DOM, no expand/collapse.** `SpanTree.tsx` (531 LOC) builds a hierarchical tree in memory (`spanMap` + `children` map at L373–386) but renders it as a flat depth-first list with indentation. There are no chevrons, no branch state, no way to collapse a noisy subtree. PLAN.md F-004 was written assuming there was no indentation at all — that part is stale (indentation exists at L86, `paddingLeft: depth * 14 + 8`), but the missing collapse is real.
- **Inconsistent palette across tabs.** `SpanTree.tsx` uses `TYPE_LABEL` (TRACE purple `#A57CF5`, TOOL_CALL `#b08c5a`, LLM_GENERATION `#5a8ab0`, INTERNAL `C.fg0`), but `FlameTimeline.tsx` uses a different per-name rotating palette (defined in `colors.ts:27–37`) plus a special LLM bar fill `rgba(255,255,255,0.38)`. A user looking at the same span in two tabs sees two different colours.
- **`SpanDetail` is a single scrolling column.** There is no internal tab state, no per-message rendering — raw input/output JSON is dumped through `JsonView` for every span. For an LLM span with 50 messages, the user has to scroll past system + 49 user/assistant turns to find what they want.
- **No view-mode control.** `RunDetail.tsx:1357–1363` shows three tabs (`Overview`, `Span Tree`, `Convo`); the Span Tree is always the flat indented list. There is no Flat/Nested toggle, no per-branch visibility state.
- **No full-session tree tab.** The Flame Timeline in `ChatFlow.tsx:598–601` (`FlameTimeline.tsx`) groups by `span.name`, not by `parent_span_id`. A user wanting to see the full parent/child hierarchy has to mentally reconstruct it from the indented list.
- **MessageList palette is washed out.** `app/src/components/MessageList.tsx:8–13` styles `system` / `user` / `assistant` / `tool` with neutral greys. There is no system/user/assistant distinction to help readers scan a long message thread.

`ai-docs/PLAN.md` F-004 (L45–119) tracks these as one Feature because they all live in the span-inspection surface. This change implements them as 5 logical sub-features (F-004.1..F-004.5), each in its own commit, all referencing `Refs F-004.`.

## What Changes

This change decomposes into 5 sub-features, each shipped as one Conventional Commit:

- **F-004.1 — Nested tree with expand/collapse.** Replace the flat DOM in `SpanTree.tsx` with a nested DOM (`<details>`-like, but using React state) and add chevrons on each row that has children. Branch-level visibility state stored in component-local state plus a `useState` map keyed by span id. Initial render: all branches expanded (matches today's behaviour).
- **F-004.2 — Unified palette + extended span types.** Move the `TYPE_LABEL` map out of `SpanTree.tsx:44–49` into `app/src/utils/span-colors.ts`. Extend `inferSpanType` in `src/parse.ts:35–41` to recognise CHAIN / RETRIEVER / EMBEDDING (currently mapped to INTERNAL at L81–84). Apply the unified palette to `FlameTimeline.tsx` tooltip badges and per-name bar colours, replacing the per-name rotating palette in `colors.ts:27–37`. Add the F-003 `SUB_AGENT_ROOT = #d4a857` entry to the unified map.
- **F-004.3 — Info tab inside `SpanDetail`.** Convert `SpanDetail.tsx:123–254` from a single column to a tabbed internal view (default tab: `Messages` for LLM spans, `Metadata` otherwise). Render LLM messages via the existing `MessageList.tsx` and `messageParsing.ts`. Update `MessageList.tsx` role styles to use a distinct palette: `system` navy, `user` cool gray, `assistant` warm orange, `tool` neutral.
- **F-004.4 — Flat/Nested view-mode toggle.** Add a small toggle in `RunDetail.tsx` between the tab strip (`L1363`) and the active renderer (`L1364`). Persist choice in `localStorage` under `workshop.spanViewMode` (no collision with existing keys per audit). Default: `nested`. Pass the mode as a prop to `SpanTree.tsx` and `FlameTimeline.tsx`.
- **F-004.5 — Full session tree tab.** Add a new tab between `Span Tree` and `Convo` (`RunDetail.tsx:1357–1362`) labelled `Session`. Render the full parent/child tree grouped by `parent_span_id` (which is already in the DB schema at `src/db/schema.ts:23–29` and indexed at L43–46). Extend `RunView` enum in `app/src/utils/navigation.ts:28–35` with `"session"`, and add the `/runs/:runId/session` route in `app/src/router.tsx`. Depends on F-003's canonical `SubAgent` shape (to label the root of each sub-agent branch).

### Scope

Files in scope (sub-feature ownership):
- `app/src/components/SpanTree.tsx` — F-004.1 (nested DOM, chevrons), F-004.2 (drop local TYPE_LABEL), F-004.4 (mode prop)
- `app/src/components/FlameTimeline.tsx` — F-004.2 (palette), F-004.4 (mode prop)
- `app/src/components/SpanDetail.tsx` — F-004.3 (internal tabs, per-message rendering)
- `app/src/components/MessageList.tsx` — F-004.3 (role palette)
- `app/src/utils/messageParsing.ts` — F-004.3 (read-only; reuse existing parser)
- `app/src/utils/span-colors.ts` (NEW) — F-004.2 (unified palette module)
- `app/src/utils/navigation.ts:28–35` — F-004.5 (extend `RunView` enum)
- `app/src/router.tsx:101–105` — F-004.5 (add `/runs/:runId/session` route)
- `src/parse.ts:35–41, L81–84` — F-004.2 (extend `inferSpanType` to recognise CHAIN/RETRIEVER/EMBEDDING)
- `app/src/components/RunDetail.tsx:1357–1362` — F-004.4 (toggle UI), F-004.5 (new tab)
- `app/src/utils/types.ts` — F-004.2 (extend inferred-span-type union), F-004.5 (extend `RunView` if not in navigation.ts)
- `app/tests-e2e/workshop-actions.spec.ts` — all 5 sub-features gain e2e assertions

### Scope OUT

- **Backend storage of `parent_span_id` as a first-class queryable join column.** Already in the schema at `src/db/schema.ts:23–29` (nullable text + index). No change needed. This change is UI-only against the existing schema.
- **Adapters populating `parent_span_id`.** Adapters today do not populate it (`AdapterInput` in `app/src/utils/types.ts:8–29` has only content fields). This change consumes what is already in the DB; populating adapters is a separate future change.
- **`OutlineSpan.child_count` plumbing.** Backend computes child counts (`src/db.ts:829–842`, calc at `L952–984`) but does not return them on `/api/runs/detail/:id`. If F-004.1 wants a "12 children" badge, this change adds a separate small backend task to plumb `child_count`; otherwise, count locally at render time.
- **Server-side parsing of CHAIN/RETRIEVER/EMBEDDING semantics.** Only the `inferSpanType` string-mapping change is in scope. Heuristic improvements (e.g. langchain vs llamaindex detection) are separate.
- **Upstream-owned files:** `Docs/`, root `AGENTS.md`, root `README.md` — do not touch.
- **F-003 `subagent-span-tree-viz`.** F-004.5 will consume the canonical `SubAgent` shape produced by F-003 (so F-003 must land first). F-004.1–F-004.4 are independent of F-003.
- **Message content redaction / token display changes.** Existing token display in `SpanDetail.tsx` remains untouched.
- **New chart/visualisation primitives.** F-004.5 uses existing `SpanTree` rendering logic with parent-grouping; no D3 / recharts introduced.
- **Plugin-side work.** Companion plugin (`~/workspase/projects/opencode-workshop-plugin/`) is out of scope; plugin F-010 will populate `subagent_name` for F-003, but F-004.5 consumes what F-003 produces.

## Capabilities

### New Capabilities
- `phoenix-spans-ui`: cohesive span-inspection UX overhaul across `SpanTree`, `FlameTimeline`, `SpanDetail`, `RunDetail` and `MessageList`. Decomposed into 5 sub-features (F-004.1..F-004.5) shipped as 5 commits, all referencing `Refs F-004.`

### Modified Capabilities
- (none — no pre-existing spec to delta; this is a brand-new capability)

## Impact

- **Code surface:** ~450–800 net LOC across 8–10 files (per sub-feature LOC estimates in the audit). Largest single sub-feature: F-004.5 (~160–280 LOC, depends on F-003).
- **API:** `/api/runs/detail/:id` shape unchanged. No new endpoints. Optionally extend the same endpoint to include `child_count` per span if F-004.1 wants a "12 children" badge — flagged as a small backend follow-up.
- **localStorage:** new key `workshop.spanViewMode` (`flat` | `nested`). No collision with existing keys per audit (`rd_llm_render_mode`, `workshop:firstTimeSetupDismissed`, `workshop:messagePane:*`, `rd_saved_*`, `rd_*_key` purged legacy).
- **Schema:** no migration. `parent_span_id` already exists; `inferSpanType` change is purely string-typed at the TS layer.
- **Tests:** `app/tests-e2e/workshop-actions.spec.ts` gains assertions for: chevron presence, nested render, palette colour per type, role palette in `MessageList`, toggle persistence, session tree route selection, expand/collapse state survival.
- **Commit cadence:** 5 commits, one per sub-feature. Order: F-004.2 (palette, lays foundation) → F-004.1 (nested DOM, uses palette) → F-004.3 (Info tab, independent) → F-004.4 (toggle, uses F-004.1) → F-004.5 (session tree, depends on F-003 + F-004.1).
- **F-003 dependency:** F-004.5 reads canonical `SubAgent` shape (mandatory: F-003 must be merged first). F-004.1..F-004.4 do not depend on F-003.
- **Docs:** `ai-docs/PLAN.md` F-004 (L45–119) marked done on merge. Two stale PLAN.md claims to correct in the merge commit body: "no parent-child indent" (L57, L90) and "shows one level" — both superseded by F-004.1.
