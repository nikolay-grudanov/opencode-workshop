# Tasks: extend-subagent-drilldown-f003

Implementation checklist for the F-003 drill-down/timeline extension. Single
commit per fork convention (one Feature = one commit); the four logical units
(timeline viz, prop forwarding, drill-down stack, span-tree dive) ship together
because the drill-down UX only coheres when all of them work.

Verification rules (apply to every task):
- `bun run build` MUST succeed after the commit.
- `bun run lint` MUST be clean after the commit.
- `bun x tsc --noEmit` MUST pass after the commit.
- No `git push` — local commit only, push requires explicit user instruction.

Reference paths (see `proposal.md`, `design.md`, `specs/subagent-span-tree-viz/spec.md`):
- MODIFY `app/src/components/FlameTimeline.tsx` — bands, gold bars/labels, click-to-dive, optional props
- MODIFY `app/src/components/ChatFlow.tsx` — forward `subAgents` + `onDiveIn` to FlameTimeline
- MODIFY `app/src/components/SpanTree.tsx` — optional `onDiveIn` → in-tree SubAgentBlock
- MODIFY `app/src/components/RunDetail.tsx` — focus stack, breadcrumb chain, childAgents, drill-down Session Tree tab

---

## 1. FlameTimeline sub-agent rendering

- [x] 1.1 Add optional props `subAgents?: SubAgent[]` and `onDiveIn?: (rootSpanId: string) => void`; when `subAgents` is undefined keep the existing internal `detectSubAgents(spans)` memo as the fallback
- [x] 1.2 Render one translucent gold vertical band per sub-agent (`rgba(212,168,87,0.07)` fill, `1px rgba(212,168,87,0.25)` left edge, `pointerEvents: "none"`, behind bars) spanning `[start_time_ms, end_time_ms]` clamped to the chart domain, full bar-area height
- [x] 1.3 Bar colour: when `spanTypeInfo(span, subAgents)` returns the SUB_AGENT_ROOT entry, use `SPAN_TYPE_COLORS.SUB_AGENT_ROOT` for the bar instead of the TOOL_CALL colour
- [x] 1.4 Row-label colour: gold for rows whose representative span is a sub-agent root
- [x] 1.5 Clicking a sub-agent root bar calls `onDiveIn?.(span.id)` and does NOT dispatch `workshop:focus-tool`; when `onDiveIn` is absent, fall back to the existing focus behaviour
- [x] 1.6 Verify: `bun x tsc --noEmit` succeeds

## 2. ChatFlow forwarding

- [x] 2.1 Pass `subAgents` and `onDiveIn` from ChatFlow's existing props into `<FlameTimeline>` at `ChatFlow.tsx:499`
- [x] 2.2 Verify: `bun x tsc --noEmit` succeeds

## 3. SpanTree dive-in

- [x] 3.1 Add optional `onDiveIn?: (rootSpanId: string) => void` to SpanTree's props
- [x] 3.2 Forward it to the in-tree `SubAgentBlock` section at `SpanTree.tsx:477` so the "Open Sub-Agent →" button renders there when provided
- [x] 3.3 Verify: `bun x tsc --noEmit` succeeds

## 4. RunDetail multi-level drill-down

- [x] 4.1 Replace `focusedAgent` state with `focusStack: string[]` + `diveIntoAgent` (idempotent push) per design D1; `focusedAgent` becomes the stack top
- [x] 4.2 Back button pops one level; run-change reset clears the stack
- [x] 4.3 Extend `ViewHeader`'s `breadcrumb` prop with optional `ancestors?: { name: string; onSelect: () => void }[]`; render the chain `Run › agent A › … › current` in the breadcrumb branch (run root clears the stack, ancestor at depth i truncates to i)
- [x] 4.4 Derive `childAgents` per design D2 and pass to the focused `ChatFlow` (`subAgents={childAgents}`, `onDiveIn={diveIntoAgent}`) replacing `subAgents={[]}`
- [x] 4.5 When `childAgents.length > 0`, add a third drill-down tab "Session Tree" rendering `<SessionTree subAgents={childAgents} spans={agentSpans} onDiveIn={diveIntoAgent} />`; widen `agentTab` state type to include `"sessions"`
- [x] 4.6 Pass `viewMode`/`onViewModeChange` to the focused `ChatFlow` (parity with the main one) and `onDiveIn={diveIntoAgent}` to both the main and focused `SpanTree`
- [x] 4.7 Verify: `bun x tsc --noEmit` succeeds

## 5. PLAN.md + e2e

- [x] 5.1 Update `ai-docs/PLAN.md` F-003 todos: check off the drill-down/timeline items covered by this change (keep plugin-side + sidebar items unchecked with a note that they are out-of-repo / scoped-out)
- [x] 5.2 Extend `app/tests-e2e/workshop-actions.spec.ts`: (a) clicking a sub-agent bar opens the focused view; (b) nested sub-agent block visible inside drill-down and opens a second level; (c) Span Tree in-tree block shows "Open Sub-Agent →"; (d) gold band present for a sub-agent
- [x] 5.3 Run the e2e harness and confirm all assertions pass — 9/9 green in `workshop-actions.spec.ts` (13.6s); base F-003 gold-badge test, previously red because the seed fixture didn't satisfy the detection contract, is now green after the fixture repair in `scripts/seed-traces.ts` (sub-agent root given `ai.toolCall.name`, `read_file` reparented to satisfy Pattern 1, and a nested `subagent.lint` agent added to cover the multi-level path)
- [x] 5.4 Final gate: `bun run build && bun run lint && bun x tsc --noEmit` all succeed
- [ ] 5.5 Smoke: load a run with nested sub-agents, dive two levels via timeline bar + breadcrumb back (requires user OK to touch the daemon)
- [x] 5.6 Committed and pushed as `1788319` on `main` → `origin/main` (commit subject `feat: sub-agent drill-down and timeline bands`, body preserved verbatim); Kolya's explicit OK received 2026-07-21
