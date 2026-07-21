# Design: extend-subagent-drilldown-f003

## D1 — Focus stack, not a single id

`RunDetail.tsx` replaces `const [focusedAgent, setFocusedAgent] = useState<string | null>(null)` with:

```ts
const [focusStack, setFocusStack] = useState<string[]>([]);
const focusedAgent = focusStack[focusStack.length - 1] ?? null;
const diveIntoAgent = (rootSpanId: string) =>
  setFocusStack((s) => (s[s.length - 1] === rootSpanId ? s : [...s, rootSpanId]));
```

- `diveIntoAgent` is passed everywhere `setFocusedAgent` was passed (main ChatFlow, main SessionTree, main SpanTree, focused ChatFlow, focused SessionTree, focused SpanTree). It is idempotent against double-push of the same id (guards the `subagent_name` popover firing twice).
- Back pops exactly one level: `setFocusStack((s) => s.slice(0, -1))`.
- Selecting breadcrumb ancestor at depth `i`: `setFocusStack((s) => s.slice(0, i + 1))`; selecting the run root clears the stack.
- The existing `runId`-change reset (`setFocusedAgent(null)`) becomes `setFocusStack([])`.

**Why a stack and not a route:** the Session Tree tab already ships as a non-routed overlay (`sessionsOverlayActive`); the drill-down follows the same pattern. URL deep-linking is Scope OUT — it adds router surface (`/runs/:id/agent/...`) for a debugging convenience nobody asked for, and agent focus is ephemeral UI state, not shareable content.

## D2 — childAgents derivation (no new detection)

`detectSubAgents.collect()` recursively gathers *all* descendants into the parent's `span_ids`, so a nested sub-agent's `root_span_id` is guaranteed to be an element of its ancestor's `span_ids`. Therefore:

```ts
const agentSpanSet = new Set(agent.span_ids);
const childAgents = subAgents.filter(
  (a) => a.root_span_id !== agent.root_span_id && agentSpanSet.has(a.root_span_id),
);
```

This runs against the run-level `subAgents` array — no second detection pass, no server change. Complexity is O(#subAgents) per render; trivially small (≤ tens).

The focused `ChatFlow` receives `subAgents={childAgents}` (was `[]`), which makes its tool-group `SubAgentBlock`s and the forwarded `FlameTimeline` bands render nested agents. The drill-down's third tab renders `<SessionTree subAgents={childAgents} spans={agentSpans} onDiveIn={diveIntoAgent} />`; `buildSessionForest` reconstructs the nesting inside the scope from the same data.

## D3 — Breadcrumb chain in ViewHeader

`ViewHeader`'s `breadcrumb` prop extends additively:

```ts
breadcrumb?: {
  onBack: () => void;
  parentName: string;
  ancestors?: { name: string; onSelect: () => void }[];
};
```

`ancestors[0]` is always the run root (label = run name, `onSelect` clears the stack); subsequent entries are the enclosing agents from outermost to innermost (labels = `Sub-agent: {subagent_name ?? name}`). The current agent keeps the existing bold title rendering. Only the drill-down call-site passes `ancestors`; all other call-sites are untouched (optional prop).

## D4 — Flame Timeline sub-agent rendering

New optional props: `subAgents?: SubAgent[]` (fallback: internal `detectSubAgents(spans)` — preserves the component's standalone behaviour) and `onDiveIn?: (rootSpanId: string) => void`.

1. **Time bands** — one absolutely positioned `<div>` per sub-agent inside the bar area, behind the bars (`zIndex` below bars, `pointerEvents: "none"`): `left = (start_time_ms - minT) * pxPerMs`, `width = max(2, duration_ms * pxPerMs)`, clamped to the chart domain; background `rgba(212, 168, 87, 0.07)` with a `1px rgba(212,168,87,0.25)` left edge. Bands span the full bar-area height (all rows), giving a "swim-lane shadow" for each agent's extent.
2. **Gold bars + labels** — bar colour and row-label colour resolve through the existing `spanTypeInfo(span, subAgents)` helper; when it returns `SUB_AGENT_ROOT`, use `SPAN_TYPE_COLORS.SUB_AGENT_ROOT` instead of the TOOL_CALL colour / default label colour.
3. **Click-to-dive** — sub-agent root bars call `onDiveIn?.(span.id)` and stop there (no `focusTool` dispatch); non-root bars keep today's behaviour. When `onDiveIn` is absent, root bars fall back to `focusTool` — no regression for standalone usage.

Bands are computed from the *prop* `subAgents` (respecting the fallback), so the focused drill-down's timeline shows only the child agents' bands inside that scope.

## D5 — Backward compatibility of touched components

Every new prop is optional. Existing call-sites (`ChatFlow` in replay/saved pages, `SpanTree` elsewhere, `FlameTimeline` standalone) compile and behave exactly as before. This mirrors the established pattern: `SubAgentBlock.onDiveIn` and `SessionTree.onDiveIn` are already optional.

## Alternatives considered

- **URL routes for agent focus** — rejected: see D1. Adds router + back-button semantics for ephemeral debug state.
- **Server-side `childAgents` field on `SubAgent`** — rejected: derivation is two lines client-side; widening the API payload duplicates data already present.
- **Auto-expanding nested agents inline in the tree instead of drill-down** — rejected: F-004.5's SessionTree already shows the nesting structure; the drill-down exists precisely to isolate one agent's conversation. Inline expansion duplicates the Session Tree's job.
- **Per-row bands (only on rows containing that agent's spans)** — rejected: full-height bands are cheaper (no per-row membership computation) and read better visually; the bars already carry the precise per-row timing.
