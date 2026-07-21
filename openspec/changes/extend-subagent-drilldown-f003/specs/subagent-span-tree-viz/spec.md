## ADDED Requirements

### Requirement: RunDetail SHALL support multi-level sub-agent drill-down with breadcrumb navigation

The run detail view SHALL allow the user to dive into a sub-agent, then into a nested sub-agent inside it, to arbitrary depth, via a focus stack of `root_span_id`s held in `RunDetail.tsx`. The breadcrumb in `ViewHeader` SHALL render the chain `Run name › agent A › agent B › …` where every ancestor is clickable and selects that level (the run root clears the stack). The Back affordance SHALL pop exactly one level. Changing the displayed run SHALL clear the stack.

#### Scenario: Dive two levels deep

- **WHEN** a run contains agent A which itself contains nested agent B (B's `root_span_id` ∈ A's `span_ids`)
- **AND** the user opens agent A from the run overview
- **AND** opens agent B from inside A's focused view
- **THEN** the focused view displays agent B's spans
- **AND** the breadcrumb renders the run name, agent A, and agent B as the current title

#### Scenario: Back pops one level

- **WHEN** the user is focused on agent B inside agent A
- **AND** activates the breadcrumb Back button
- **THEN** the focused view returns to agent A (the stack pops one level, not to the run root)

#### Scenario: Breadcrumb ancestor selection

- **WHEN** the user is focused on agent B inside agent A
- **AND** clicks the run-name crumb
- **THEN** the stack clears and the main run view renders

#### Scenario: Run change resets the stack

- **WHEN** the user is focused on any agent and navigates to a different run
- **THEN** the focus stack is empty and the new run's main view renders

### Requirement: The focused sub-agent view SHALL render nested sub-agents

When the focused agent contains nested sub-agents (`childAgents` — sub-agents whose `root_span_id` appears in the focused agent's `span_ids`, excluding the focused agent itself), the focused view's chat tab SHALL render `SubAgentBlock`s for them (via `ChatFlow`'s existing `subAgents` prop, previously hardcoded to `[]`), and the focused view SHALL offer a "Session Tree" tab rendering `SessionTree` scoped to `childAgents` and the focused agent's spans. When the focused agent contains no nested sub-agents, the "Session Tree" tab SHALL NOT render and the chat tab SHALL show no sub-agent blocks.

#### Scenario: Nested sub-agent visible and openable in drill-down

- **WHEN** the user is focused on agent A which contains nested agent B
- **THEN** A's chat tab renders a `SubAgentBlock` for B whose "Open Sub-Agent →" button dives into B

#### Scenario: Scoped Session Tree tab in drill-down

- **WHEN** the user is focused on agent A which contains nested agents B and C
- **AND** selects the "Session Tree" tab inside the drill-down
- **THEN** `SessionTree` renders with B and C (and their own nesting) but no agents outside A

#### Scenario: Leaf agent has no Session Tree tab

- **WHEN** the user is focused on an agent with no nested sub-agents
- **THEN** only the "Overview" and "Span Tree" tabs render inside the drill-down

### Requirement: SpanTree's in-tree SubAgentBlock SHALL offer dive-in when `onDiveIn` is provided

`SpanTree.tsx` SHALL accept an optional `onDiveIn?: (rootSpanId: string) => void` prop and forward it to its in-tree `SubAgentBlock` section. When provided, each block's "Open Sub-Agent →" button SHALL render and invoke `onDiveIn` with the sub-agent's `root_span_id`. When absent, the section SHALL render exactly as before (no button), preserving standalone usage.

#### Scenario: Dive from the Span Tree tab

- **WHEN** a run contains a sub-agent and the user opens the Span Tree tab
- **AND** clicks "Open Sub-Agent →" on the in-tree block
- **THEN** the focused view for that sub-agent opens (the focus stack gains its `root_span_id`)

### Requirement: FlameTimeline SHALL render sub-agent time extent and identity

`FlameTimeline.tsx` SHALL accept optional `subAgents?: SubAgent[]` and `onDiveIn?: (rootSpanId: string) => void` props, falling back to its internal `detectSubAgents(spans)` result when `subAgents` is absent. For each sub-agent it SHALL render: (1) a translucent gold vertical band (`rgba(212,168,87,0.07)`) spanning `[start_time_ms, end_time_ms]` clamped to the chart domain, behind the bars and non-interactive; (2) gold (`#d4a857`) bars for sub-agent root spans; (3) gold row labels for rows whose representative span is a sub-agent root. Clicking a sub-agent root bar SHALL invoke `onDiveIn` with that span's id and SHALL NOT dispatch the `workshop:focus-tool` event; when `onDiveIn` is absent, root bars keep the existing focus behaviour.

#### Scenario: Sub-agent band visible

- **WHEN** a run contains a sub-agent and the Flame Timeline renders
- **THEN** a translucent gold vertical band covers the sub-agent's `[start, end]` interval across the full bar-area height

#### Scenario: Sub-agent root bar is gold

- **WHEN** a sub-agent root TOOL_CALL span renders as a timeline bar
- **THEN** the bar uses `#d4a857`, not the generic TOOL_CALL colour

#### Scenario: Click root bar dives

- **WHEN** the timeline receives `onDiveIn` and the user clicks a sub-agent root bar
- **THEN** `onDiveIn` is invoked with the root span id and no `workshop:focus-tool` event is dispatched

#### Scenario: Non-root bar behaviour unchanged

- **WHEN** the user clicks a bar that is not a sub-agent root
- **THEN** the existing focus-tool behaviour fires exactly as before this change

#### Scenario: Standalone timeline without new props

- **WHEN** `FlameTimeline` renders without `subAgents` or `onDiveIn` (existing call-sites)
- **THEN** bands and gold bars still render (via internal detection) and clicks behave as before
