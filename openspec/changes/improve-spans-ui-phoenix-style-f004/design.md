## Context

Workshop's run-inspection UI today splits across four components that were built incrementally and never unified:

- **`app/src/components/SpanTree.tsx`** (531 LOC) — the primary span-list surface. Builds a hierarchical tree in memory (`spanMap` + `children` map at L373–386) and renders it as a **flat** depth-first list. Indentation exists (L86, `paddingLeft: depth * 14 + 8`), but no chevrons, no branch state, no collapse. Has its own `TYPE_LABEL` colour map at L44–49: TRACE purple `#A57CF5`, TOOL_CALL `#b08c5a`, LLM_GENERATION `#5a8ab0`, INTERNAL `C.fg0`.
- **`app/src/components/FlameTimeline.tsx`** (L151–394) — a different visualisation mounted in `ChatFlow.tsx:598–601` as the "Trajectory" panel. Filters to TRACE/TOOL_CALL/LLM (`L151–154`) and groups **by span name, not by parent** (`L199–219`). Uses a per-name rotating palette from `app/src/utils/colors.ts:27–37` and an LLM-specific fill `rgba(255,255,255,0.38)`.
- **`app/src/components/SpanDetail.tsx`** (L123–254) — single-column scroll, metadata + provider options + raw input/output via `JsonView`. No internal tab state. No per-message rendering.
- **`app/src/components/MessageList.tsx`** (`L8–13`) — renders `system` / `user` / `assistant` / `tool` all in neutral greys.
- **`app/src/components/RunDetail.tsx`** (`L1357–1363`) — tabs are `Overview` / `Span Tree` / `Convo`. No view-mode control, no full-session-tree tab.

Backend:
- `src/parse.ts:35–41` `inferSpanType` returns one of `LLM_GENERATION | TOOL_CALL | AGENT_ROOT | TRACE | INTERNAL`. CHAIN/RETRIEVER/EMBEDDING currently map to `INTERNAL` (`L81–84` explicitly comments "embeddings/retrievals remain INTERNAL").
- `src/db/schema.ts:23–29` has `parent_span_id TEXT` (nullable) + index `L43–46`. Already indexed, no migration needed.
- `src/db.ts:829–842` computes `OutlineSpan.child_count` (`L952–984`) but it is not plumbed into `/api/runs/detail/:id` (which returns only `Span[]` + `SubAgent[]`).

Adjacent repo: companion plugin at `~/workspase/projects/opencode-workshop-plugin/`. Plugin F-010 will populate `attributes.subagent_name` (F-003 in this repo consumes it). F-004.5 reads the canonical `SubAgent` shape produced by F-003, so F-003 must land first.

Constraints inherited (per `ai-docs/AGENTS.md` and `ai-docs/HANDOFF.md`):
- Local-only debugger; no cloud deps; no app.raindrop.ai; no OAuth.
- One Feature = one commit (per F-NNN). For F-004, five sub-features inside the Feature = five commits, all `Refs F-004.` in the body.
- Upstream-owned files (`Docs/`, root `AGENTS.md`, root `README.md`) MUST NOT be edited.
- Never restart daemon without explicit user OK; never `git push` without explicit instruction.

## Goals / Non-Goals

**Goals:**
- F-004.1: Replace flat DOM in `SpanTree.tsx` with a nested DOM that has chevrons and expand/collapse state, initialised to "all expanded".
- F-004.2: Extract the colour map into `app/src/utils/span-colors.ts` and apply it consistently across `SpanTree` and `FlameTimeline`. Extend `inferSpanType` to surface `CHAIN`, `RETRIEVER`, `EMBEDDING` as named types (each with a colour), while keeping today's `INTERNAL` as the catch-all.
- F-004.3: Convert `SpanDetail.tsx` to a tabbed internal view. For LLM spans the default tab is `Messages` (rendered via existing `MessageList`); for non-LLM spans the default tab is `Metadata`. Update `MessageList` to use a distinct role palette (system navy, user gray, assistant orange, tool neutral).
- F-004.4: Add a `Flat | Nested` toggle in `RunDetail.tsx` between the tab strip and the active renderer. Persist choice in `localStorage` under `workshop.spanViewMode`. Default: `nested`. The toggle drives both `SpanTree` and `FlameTimeline`.
- F-004.5: Add a new tab `Session` between `Span Tree` and `Convo` in `RunDetail.tsx`. Render the full parent/child tree grouped by `parent_span_id`. Add `/runs/:runId/session` route. Consume the canonical `SubAgent` shape from F-003 to label sub-agent roots.

**Non-Goals:**
- Backend migration. `parent_span_id` already exists in the schema.
- Adapter populating of `parent_span_id` (out of scope; this change consumes what is already in DB).
- New endpoints. `/api/runs/detail/:id` shape unchanged.
- Heuristic detection of langchain vs llamaindex for CHAIN/RETRIEVER/EMBEDDING — only the string-mapping change is in scope.
- F-003 `subagent-span-tree-viz` work — separate change.
- Companion plugin work — separate repo.
- New visualisation primitives (D3, recharts, etc.).
- Upstream-owned file edits.

## Decisions

### D1 — Sub-feature commit order: F-004.2 → F-004.1 → F-004.3 → F-004.4 → F-004.5. (load-bearing)

The palette module (`F-004.2`) is foundational — every later sub-feature consumes it. Nested DOM (`F-004.1`) builds on the palette. Info tab (`F-004.3`) is independent and can land in any slot. View-mode toggle (`F-004.4`) needs the nested DOM to be meaningful (`flat` simply suppresses the nested DOM). Session tree (`F-004.5`) depends on both F-003 (canonical `SubAgent`) and F-004.1 (nested-DOM rendering primitives).

**Alternatives considered:**
- Land F-004.5 last (after F-004.1 + F-003) — chosen. F-004.3 placed before F-004.4 because it touches `SpanDetail.tsx` (a different file surface) and keeps each commit's blast radius small.
- Bundle all 5 into one commit — rejected: ~700 LOC monolith violates "small atomic commits" spirit of the fork's convention.

### D2 — Palette extracted to `app/src/utils/span-colors.ts`. (load-bearing)

A new module `span-colors.ts` exports a single `SPAN_TYPE_COLORS: Record<SpanType, string>` constant and a `spanColor(type: SpanType): string` helper. Both `SpanTree.tsx` and `FlameTimeline.tsx` import from it. `SpanTree.tsx:44–49`'s local `TYPE_LABEL` is deleted. `app/src/utils/colors.ts:27–37` (per-name rotating palette) is replaced with a per-type palette that takes the type from `inferSpanType`, not the span name.

**Alternatives considered:**
- Keep the colour map inline in each component, with a shared token file like `colors.ts` — rejected: that is the status quo, and it's the source of the inconsistency.
- Move palette to a CSS-in-JS theme — rejected: the repo uses no CSS-in-JS today; introducing one for one Feature is scope creep.

### D3 — Expand/collapse state: React `useState<Map<string, boolean>>` keyed by span id, seeded with all `true`. (reversible)

Each `SpanTree` row that has children renders a chevron (e.g. `▸` collapsed, `▾` expanded). Click toggles the entry in the map. State is component-local (no global store, no URL state in this change). Initial render: all branches expanded (matches today's behaviour). When the run changes, state resets via `useEffect` on `runId`.

**Alternatives considered:**
- Persist collapse state across runs in `localStorage` — rejected: this is a UI preference, not a session preference; users expect "I just opened a run, show me everything." Persisted state was a tempting feature but adds ambiguity about which spans belong to which run.
- Use HTML `<details>` / `<summary>` — rejected: those elements don't compose well with the existing row layout (indent + chevron + badge + name + duration) without significant CSS overrides.
- Use a global Zustand/Redux store — rejected: not used elsewhere in the repo; component-local state matches the existing convention.

### D4 — View-mode localStorage key: `workshop.spanViewMode` (`flat` | `nested`). (reversible)

Audit-confirmed no collision with existing keys (`rd_llm_render_mode`, `workshop:firstTimeSetupDismissed`, `workshop:messagePane:*`, `rd_saved_*`, `rd_*_key` purged legacy). Default `nested`. Read once on mount with a defensive parse (treat malformed JSON as `nested`).

**Alternatives considered:**
- Per-run state in URL (`?view=nested`) — rejected: complicates sharing links; not asked for.
- Per-tab in URL (`/runs/:id/spans?view=nested` vs `/runs/:id/spans?view=flat`) — rejected: pollutes route surface; the toggle is a presentation preference, not navigation.
- `workshop:spanViewMode` (with colon) — rejected: audit shows the colon-prefixed keys are used for the `messagePane` family, which has its own migration story. Plain dot-less `workshop.spanViewMode` matches `workshop:firstTimeSetupDismissed` style.

### D5 — `child_count` for F-004.1 badges: count locally at render time, no backend change. (reversible)

`SpanTree.tsx` already has access to the full span list and the `children` map (`L373–386`). Computing `children.get(span.id)?.length ?? 0` at render is O(1) per row and avoids a backend change. The existing backend `OutlineSpan.child_count` plumbing (`src/db.ts:829–842`) is left untouched — it remains available for the `/api/runs/outline` endpoint but is not added to `/api/runs/detail/:id` in this change.

**Alternatives considered:**
- Plumb `child_count` into `/api/runs/detail/:id` — rejected for this change: backend edit is larger scope than the UI benefit. If profiling later shows the local count is too slow for runs with thousands of spans, plumb it then.
- Drop the badge entirely — rejected: a "12 children" indicator is the primary signal for "this is a subtree worth exploring" in the nested DOM.

### D6 — F-004.5 consumes F-003 canonical `SubAgent` shape: a `subagent_span_id → SubAgent` lookup built once per render. (load-bearing)

F-004.5 groups spans by `parent_span_id` recursively. To label sub-agent roots, build a `Map<string, SubAgent>` keyed by `root_span_id` (one O(N) pass). The map is consumed when rendering the group header for each top-level sub-agent. F-003's `SubAgent` shape (incl. `subagent_name?: string`) is the single source of truth — F-004.5 does not re-derive `name` from `span.name`.

**Alternatives considered:**
- Re-call `detectSubAgents` inside the session-tree renderer — rejected: F-003 collapsed the three copies to one canonical implementation; reusing it is the whole point of the consolidation. Calling it again on the client creates a parallel copy.
- Read `subagent_name` from `span.attributes.subagent_name` directly — rejected: this bypasses the canonical `SubAgent` shape and creates two sources of truth for "what is this sub-agent called?".

## Risks / Trade-offs

- **Risk:** Palette change (F-004.2) shifts colour for any user who has muscle-memorised today's colours → mild visual disruption. **Mitigation:** document the change in the commit body; F-004.2 is the second commit so users see it after one preview build.
- **Risk:** Nested DOM with hundreds of branches slows render. **Mitigation:** audit shows typical runs have <100 spans; React reconciliation cost is linear in tree size. If profiling shows regression, memoise rows with `React.memo`. Out of scope for this change.
- **Risk:** F-003 not yet merged when F-004.5 lands → F-004.5 imports a type that does not exist. **Mitigation:** commit order is enforced by the plan (F-003 first, F-004.5 last within F-004). Document in F-004.5 tasks.md that the import must point at the F-3-merged `src/agents.ts`.
- **Risk:** Extending `inferSpanType` to surface CHAIN/RETRIEVER/EMBEDDING breaks existing callers that exhaustively `switch` over the union. **Mitigation:** `src/parse.ts:35–41` is exhaustively switched only inside the parse path; audit found no downstream `switch(spanType)` in `app/` that doesn't already have an `INTERNAL` default. New types fall through to the same default until callers are updated.
- **Risk:** `MessageList.tsx` role palette change shifts the entire conversation-panel visual identity. **Mitigation:** F-004.3 is its own commit; users see the change isolated from the palette + tree work.
- **Trade-off:** Five commits inside F-004 makes git log of the Feature verbose, but each commit is independently reviewable and reverts cleanly. Matches the fork's F-001 precedent (5 commits for 5 features).

## Migration Plan

No data migration. UI-only change. Rollback = revert the affected commit(s). No daemon restart needed (assets are bundled into the Vite dev server). User's standing rule "never restart the daemon without explicit OK" still applies.

Plugin-side coupling: F-004.5 reads `SubAgent.subagent_name` populated by plugin F-010 in the other repo. If the plugin lands after this Workshop change, F-004.5 already degrades gracefully (falls back to parent TOOL_CALL span name). No coordinated rollout required.

## Open Questions

- Should `SpanDetail` tabs be keyboard-navigable (arrow keys, `Ctrl+Tab`)? **Default proposal:** no for this change — would add accessibility scope. Track as a follow-up under F-007 ("keyboard navigation overhaul").
- Should the view-mode toggle persist per-user or per-tab? **Default proposal:** per-user, single key for the whole app. If the `Flat` view is useful for some tabs but not others, users will tell us.
- Should the Session tree tab also show agent-root grouping (i.e. AGENT_ROOT spans become the top-level groups)? **Default proposal:** yes — that's the whole point of consuming F-003's `SubAgent` shape. AGENT_ROOT and sub-agent root become the natural group headings.
