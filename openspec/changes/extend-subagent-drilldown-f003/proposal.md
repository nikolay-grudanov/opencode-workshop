## Why

F-003 (`add-subagent-visualization-f003`) shipped sub-agent *visualization*: gold `SUB_AGENT_ROOT` badges, friendly `Sub-agent: {name}` labels, an in-tree `SubAgentBlock` section, and a gold tooltip badge in the Flame Timeline. But *navigation* is still shallow:

1. **Single-level drill-down only.** `RunDetail.tsx` holds one `focusedAgent` id. The focused-agent view passes `subAgents={[]}` to its `ChatFlow`, so nested sub-agents (a sub-agent that itself spawned sub-agents) are invisible inside the drill-down — the user cannot follow an agent chain deeper than one level, even though `detectSubAgents`' recursive `collect()` already places nested roots inside the parent's `span_ids`.
2. **No dive affordance from the Span Tree tab.** The in-tree `SubAgentBlock` section (`SpanTree.tsx:477`) renders without `onDiveIn`, so its "Open Sub-Agent →" button never appears there; diving is only possible from the Overview tab.
3. **The Flame Timeline is sub-agent-blind.** Sub-agent root bars use the generic TOOL_CALL colour (only the tooltip badge is gold), there is no indication of a sub-agent's time extent, and clicking a sub-agent bar only focuses the span instead of opening the sub-agent.

This change closes those gaps: multi-level drill-down with a breadcrumb chain, nested sub-agent visibility inside the drill-down (chat blocks + scoped Session Tree), dive-in from the Span Tree, and a sub-agent-aware Flame Timeline (gold bars/labels, translucent time bands, click-to-dive).

F-003 in `ai-docs/PLAN.md` (L18–37) tracks this feature; this change is the drill-down/timeline extension of it.

## What Changes

- **Multi-level drill-down** — replace `focusedAgent: string | null` in `RunDetail.tsx` with a `focusStack: string[]`. Diving pushes a `root_span_id`; Back pops one level; changing the run clears the stack. `ViewHeader`'s `breadcrumb` prop gains an optional `ancestors: { name: string; onSelect: () => void }[]` chain rendered as `Run › agent A › agent B`.
- **Nested sub-agent visibility** — the focused-agent view derives `childAgents` (sub-agents whose `root_span_id` is inside the current agent's `span_ids`, minus itself) and passes them to the focused `ChatFlow` instead of `subAgents={[]}`, so nested `SubAgentBlock`s render and multi-level dive works. When `childAgents.length > 0`, the drill-down gains a third "Session Tree" tab rendering `SessionTree` scoped to `childAgents` + `agentSpans`.
- **Span Tree dive-in** — `SpanTree.tsx` gains an optional `onDiveIn?: (rootSpanId: string) => void` prop, forwarded to its in-tree `SubAgentBlock` section so the "Open Sub-Agent →" button appears there. Both the main tree and the focused tree pass it.
- **Flame Timeline sub-agent rendering** — `FlameTimeline.tsx`:
  - Sub-agent root bars and their row labels use the gold `SUB_AGENT_ROOT = #d4a857` colour (bars currently don't).
  - Each sub-agent gets a translucent gold vertical time band across the chart spanning `[start_time_ms, end_time_ms]`.
  - Clicking a sub-agent root bar invokes a new optional `onDiveIn` prop (other bars keep the existing focus-tool behaviour).
  - New optional `subAgents` prop; falls back to internal `detectSubAgents(spans)` when absent.
- **ChatFlow forwarding** — `ChatFlow.tsx` forwards its existing `subAgents` and `onDiveIn` props to `FlameTimeline` (currently dropped at `ChatFlow.tsx:499`).

### Scope

Files in scope:
- `app/src/components/RunDetail.tsx` — focus stack, breadcrumb chain, `childAgents`, drill-down Session Tree tab, `viewMode` passthrough to the focused ChatFlow
- `app/src/components/SpanTree.tsx` — optional `onDiveIn` prop → in-tree `SubAgentBlock`
- `app/src/components/ChatFlow.tsx` — forward `subAgents` + `onDiveIn` to `FlameTimeline`
- `app/src/components/FlameTimeline.tsx` — gold bars/labels, time bands, click-to-dive, optional `subAgents`/`onDiveIn` props

### Scope OUT

- **URL deep-linking for focused agents** (e.g. `/runs/:id/agent/:spanId`). The drill-down stays local component state, mirroring how the Session Tree tab already works as a non-routed overlay. Router surface unchanged.
- **Server-side / detection changes.** `src/agents.ts` `detectSubAgents` and the `SubAgent` shape are untouched; all derivation happens client-side from data already returned by `/api/runs/detail/:id`.
- **The "Sub-agents" filter sidebar** mentioned in `PLAN.md` F-003 — already scoped OUT by the base F-003 proposal (no sidebar component exists).
- **Plugin-side work** (`subagent_name` emission) — separate repo, unchanged.
- **The main (unfocused) Session Tree tab** — unchanged; it already receives `onDiveIn`.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `subagent-span-tree-viz`: extends the shipped F-003 capability with drill-down navigation (multi-level stack, breadcrumb chain, nested visibility, Span Tree dive-in) and Flame Timeline sub-agent rendering (bands, gold bars, click-to-dive).

## Impact

- **Code surface:** ~`+180` to `+260` net LOC across 4 component files. No deletions of behaviour; the focused-agent view is restructured but preserves its existing tabs and stats.
- **API:** unchanged. `/api/runs/detail/:id` already returns `subAgents[]` and full spans; all new derivation (`childAgents`, bands) is client-side.
- **Schema:** no migration.
- **Tests:** e2e assertions for: (1) clicking a sub-agent bar in the Flame Timeline opens the focused view; (2) a nested sub-agent block is visible inside the drill-down and can be opened (two levels deep); (3) the Span Tree's in-tree `SubAgentBlock` shows "Open Sub-Agent →"; (4) gold time band present for a sub-agent.
- **Docs:** `ai-docs/PLAN.md` F-003 todos updated in the same commit.
