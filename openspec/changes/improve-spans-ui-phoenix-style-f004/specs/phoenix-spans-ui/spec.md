## ADDED Requirements

### Requirement: Span Tree SHALL render rows as a nested DOM with chevrons and per-branch expand/collapse state

`SpanTree.tsx` SHALL render the span list as a **nested DOM** (not the current flat depth-first list), where each row that has child spans renders a chevron control (`▸` collapsed, `▾` expanded) preceding the type badge. Clicking the chevron SHALL toggle the row's expand/collapse state. State SHALL be stored as a `Map<span_id, boolean>` seeded with all `true`. Initial render: every branch expanded. When the user switches runs (`runId` changes), state SHALL reset to all-expanded.

#### Scenario: Row with children shows chevron

- **WHEN** the user opens the Span Tree tab for a run that has nested spans
- **THEN** every row whose span has children renders a chevron in the leading column; rows without children render no chevron

#### Scenario: Clicking chevron collapses subtree

- **WHEN** the user clicks the chevron on a row with children
- **THEN** the subtree rooted at that span is hidden; the chevron rotates to `▸`

#### Scenario: Clicking chevron again expands subtree

- **WHEN** the user clicks the chevron on a previously collapsed row
- **THEN** the subtree is re-rendered; the chevron rotates to `▾`

#### Scenario: Switching runs resets collapse state

- **WHEN** the user navigates from one run to another (different `runId`)
- **THEN** every branch of the new run renders in the expanded state; previously collapsed rows do not carry over

### Requirement: Span Tree SHALL display a child-count badge on rows with children

Each row that has child spans SHALL display a small numeric badge (e.g. `12`) immediately after the type badge indicating the number of direct children (computed locally via `children.get(span.id)?.length`). The badge SHALL be hidden when the count is zero.

#### Scenario: Row with two children shows badge "2"

- **WHEN** a span has two direct child spans
- **THEN** the row renders a child-count badge displaying `2`

#### Scenario: Leaf row shows no badge

- **WHEN** a span has zero child spans
- **THEN** the row renders no child-count badge

### Requirement: Span colours SHALL be sourced from a single shared palette module and applied consistently across SpanTree and FlameTimeline

A new module `app/src/utils/span-colors.ts` SHALL export `SPAN_TYPE_COLORS: Record<SpanType, string>` covering at minimum: `TRACE`, `LLM_GENERATION`, `TOOL_CALL`, `AGENT_ROOT`, `INTERNAL`, `CHAIN`, `RETRIEVER`, `EMBEDDING`, `SUB_AGENT_ROOT`. Both `SpanTree.tsx` and `FlameTimeline.tsx` SHALL import colours from this module. The local `TYPE_LABEL` map in `SpanTree.tsx:44–49` SHALL be removed. The per-name rotating palette in `app/src/utils/colors.ts:27–37` SHALL be replaced with per-type colour resolution (using `inferSpanType` output as the key).

#### Scenario: SpanTree uses shared palette

- **WHEN** `SpanTree.tsx` renders a row
- **THEN** the badge colour is looked up via `spanColor(spanType)` from `app/src/utils/span-colors.ts`; no inline colour map exists in `SpanTree.tsx`

#### Scenario: FlameTimeline uses shared palette

- **WHEN** `FlameTimeline.tsx` renders a tooltip badge
- **THEN** the badge colour is looked up via `spanColor(spanType)` from `app/src/utils/span-colors.ts`; no per-name rotating palette is used

#### Scenario: Same span type renders same colour in both tabs

- **WHEN** a TOOL_CALL span is rendered in both the Span Tree tab and the Flame Timeline tooltip
- **THEN** both render the same colour value (e.g. `#b08c5a`)

### Requirement: `inferSpanType` SHALL surface CHAIN, RETRIEVER, and EMBEDDING as named types instead of collapsing to INTERNAL

`src/parse.ts:35–41` `inferSpanType` SHALL return one of `LLM_GENERATION | TOOL_CALL | AGENT_ROOT | TRACE | INTERNAL | CHAIN | RETRIEVER | EMBEDDING`. The CHAIN/RETRIEVER/EMBEDDING types SHALL be inferred from OTLP/AI-sdk attributes when present (e.g. `span.name` containing "chain", "retriever", "embedding", or dedicated `gen_ai.span.kind` attribute values). When the input does not indicate any of the named types, the function SHALL continue to return `INTERNAL`.

#### Scenario: LangChain chain span returns CHAIN

- **WHEN** `inferSpanType` is called on a span with `gen_ai.span.kind = "chain"` or `span.name` containing "chain"
- **THEN** the function returns `"CHAIN"`

#### Scenario: Retriever span returns RETRIEVER

- **WHEN** `inferSpanType` is called on a span with `gen_ai.span.kind = "retriever"` or `span.name` containing "retriever"
- **THEN** the function returns `"RETRIEVER"`

#### Scenario: Unknown span stays INTERNAL

- **WHEN** `inferSpanType` is called on a span with no chain/retriever/embedding signal
- **THEN** the function returns `"INTERNAL"` (unchanged from today's behaviour)

### Requirement: `SpanDetail` SHALL render an internal tabbed view with type-appropriate default tab

`SpanDetail.tsx` SHALL render an internal tab strip (`Messages` and `Metadata` for LLM spans; only `Metadata` for non-LLM spans). The default tab SHALL be `Messages` for spans whose inferred type is `LLM_GENERATION`, and `Metadata` otherwise. The `Messages` tab SHALL render the span's messages via `MessageList` + `messageParsing.ts`. The `Metadata` tab SHALL render the existing metadata + provider options + raw input/output `JsonView`.

#### Scenario: LLM span opens on Messages tab

- **WHEN** the user clicks an LLM_GENERATION span row
- **THEN** `SpanDetail` renders with the `Messages` tab selected by default, showing the span's messages via `MessageList`

#### Scenario: TOOL_CALL span opens on Metadata tab

- **WHEN** the user clicks a TOOL_CALL span row
- **THEN** `SpanDetail` renders with the `Metadata` tab selected by default (no `Messages` tab is rendered)

#### Scenario: Switching tabs preserves state

- **WHEN** the user clicks between the `Messages` and `Metadata` tabs on the same span
- **THEN** the active tab changes immediately without losing the other tab's content

### Requirement: `MessageList` SHALL style message roles with a distinct palette

`app/src/components/MessageList.tsx` SHALL apply distinct background/border colours per role: `system` navy, `user` cool gray, `assistant` warm orange, `tool` neutral (current). The palette SHALL be sourced from the same shared colour module family (or inline tokens, but consistent with the rest of the change).

#### Scenario: System message uses navy

- **WHEN** a system-role message is rendered
- **THEN** its background/border uses a navy palette distinct from the user and assistant palettes

#### Scenario: Assistant message uses orange

- **WHEN** an assistant-role message is rendered
- **THEN** its background/border uses a warm orange palette distinct from the user palette

#### Scenario: Tool message uses neutral palette

- **WHEN** a tool-role message is rendered
- **THEN** its background/border uses the existing neutral palette, unchanged by this change

### Requirement: `RunDetail` SHALL expose a Flat/Nested view-mode toggle that drives both SpanTree and FlameTimeline

`RunDetail.tsx` SHALL render a small `Flat | Nested` toggle between the tab strip (`L1363`) and the active renderer. The selected mode SHALL be passed as a prop to `SpanTree.tsx` and `FlameTimeline.tsx`, both of which SHALL respect it: in `flat` mode, `SpanTree` renders the legacy flat depth-first list (no nested DOM, no chevrons); in `nested` mode, `SpanTree` renders the new nested DOM. Default mode SHALL be `nested`.

#### Scenario: Toggle is visible in RunDetail

- **WHEN** the user opens any run in `RunDetail.tsx`
- **THEN** a `Flat | Nested` toggle is rendered between the tab strip and the active renderer

#### Scenario: Selecting Flat mode flattens the tree

- **WHEN** the user selects `Flat`
- **THEN** `SpanTree` renders the flat depth-first list (chevrons hidden, no expand/collapse interaction)

#### Scenario: Selecting Nested mode renders nested tree

- **WHEN** the user selects `Nested`
- **THEN** `SpanTree` renders the nested DOM with chevrons and expand/collapse

### Requirement: View-mode choice SHALL persist in `localStorage` under `workshop.spanViewMode`

The selected view mode SHALL be persisted in `localStorage` under the key `workshop.spanViewMode` with values `"flat"` or `"nested"`. On mount, the value SHALL be read once with defensive parsing (malformed JSON → `nested`). When the user switches modes, the value SHALL be written immediately.

#### Scenario: Selected mode persists across reloads

- **WHEN** the user selects `Flat`
- **AND** reloads the page
- **THEN** the toggle re-renders with `Flat` selected and `SpanTree` renders in flat mode

#### Scenario: Malformed localStorage value defaults to nested

- **WHEN** `localStorage.getItem("workshop.spanViewMode")` returns malformed JSON
- **THEN** the toggle initialises to `nested` (defensive default; no error thrown)

#### Scenario: No collision with existing keys

- **WHEN** this change is merged
- **THEN** the only new key in `localStorage` is `workshop.spanViewMode`; existing keys (`rd_llm_render_mode`, `workshop:firstTimeSetupDismissed`, `workshop:messagePane:*`, `rd_saved_*`, `rd_*_key`) are untouched

### Requirement: RunDetail SHALL render a `Session` tab between `Span Tree` and `Convo` that displays the full parent/child tree

`RunDetail.tsx` SHALL add a new tab labelled `Session` between `Span Tree` and `Convo` (around `L1357–1362`). The `Session` tab SHALL render the full span tree grouped by `parent_span_id`, recursively. Each top-level group SHALL be labelled with the canonical `SubAgent` shape from F-003 (display name, model, span count, status). The `RunView` enum in `app/src/utils/navigation.ts:28–35` SHALL be extended with `"session"`. The router at `app/src/router.tsx:101–105` SHALL register the route `/runs/:runId/session`.

#### Scenario: Session tab visible in RunDetail

- **WHEN** the user opens any run in `RunDetail.tsx`
- **THEN** the tab strip includes `Overview`, `Span Tree`, `Session`, `Convo` (in that order)

#### Scenario: Session tab renders parent/child tree

- **WHEN** the user clicks the `Session` tab
- **THEN** the renderer displays the full span tree grouped by `parent_span_id`, with sub-agent roots labelled using the canonical `SubAgent` shape from F-003

#### Scenario: Session route is reachable via URL

- **WHEN** the user navigates to `/runs/:runId/session`
- **THEN** the `Session` tab is selected and its renderer is active

### Requirement: No backend migration or new endpoints SHALL be required

This change SHALL NOT require any SQLite migration. `parent_span_id` is already in the `spans` table schema (`src/db/schema.ts:23–29`) and indexed (`L43–46`). The `/api/runs/detail/:id` endpoint SHALL NOT change shape. No new endpoints SHALL be added.

#### Scenario: Daemon starts without migration

- **WHEN** the daemon boots after this change
- **THEN** no migration runs; the `spans` table schema is byte-identical to the pre-change schema

#### Scenario: API shape unchanged

- **WHEN** a client requests `/api/runs/detail/:id` before and after this change
- **THEN** the response body has the same keys (`Span[]`, `SubAgent[]`, run metadata)
