## ADDED Requirements

### Requirement: Pure helpers SHALL be ported from hermes-webui to TypeScript 1:1 with no behaviour drift

The five pure helpers (`neutralizeRemoteImages`, `renderMarkdown`, `contentToText`, `fmtTs`, `paletteToCss`) and the `renderSessionHtml` glue SHALL exist in `src/export/html-export.ts` with semantics identical to their Python counterparts in `~/hermes-webui/api/session_export_html.py`. Each helper SHALL accept the same input shape and produce the same output shape (modulo language-idiomatic naming: snake_case → camelCase). All 17 hermes-webui tests SHALL pass when run against the TS port.

#### Scenario: neutralizeRemoteImages flattens remote img tags

- **WHEN** `neutralizeRemoteImages` is called on rendered HTML containing `<img src="https://example.com/x.png">`
- **THEN** the function replaces the tag with `<code>[image: https://example.com/x.png]</code>` and the original `<img>` is no longer present in the output

#### Scenario: neutralizeRemoteImages preserves data URIs

- **WHEN** `neutralizeRemoteImages` is called on rendered HTML containing `<img src="data:image/png;base64,...">`
- **THEN** the `<img>` tag is preserved verbatim

#### Scenario: renderMarkdown renders headings and code blocks

- **WHEN** `renderMarkdown` is called with `## Title` and `` `code` ``
- **THEN** the output contains `<h2>Title</h2>` and `<code>code</code>` (with `html: false` set, raw HTML inside Markdown source is escaped, not rendered)

#### Scenario: contentToText flattens OpenAI-style mixed content

- **WHEN** `contentToText` is called with a `[{type: "text", text: "hello"}, {type: "image_url", image_url: {url: "https://x"}}]` payload
- **THEN** the function returns a single string with `"hello"` plus an inert `[image: ...]` placeholder for the remote URL

#### Scenario: fmtTs formats unix milliseconds as YYYY-MM-DD HH:MM:SS

- **WHEN** `fmtTs` is called with a Unix epoch in milliseconds (e.g. `1700000000000`)
- **THEN** the function returns a string matching the pattern `%Y-%m-%d %H:%M:%S` (e.g. `"2023-11-14 22:13:20"`)

#### Scenario: paletteToCss sanitises a benign palette

- **WHEN** `paletteToCss` is called with `{"--accent": "#5a8ab0"}`
- **THEN** the output contains `:root { --accent: #5a8ab0; }`

#### Scenario: paletteToCss drops url() payloads

- **WHEN** `paletteToCss` is called with `{"--accent": "url(https://x/x)"}`
- **THEN** the output does NOT contain `url(` (the entry is dropped)

#### Scenario: paletteToCss drops expression() payloads

- **WHEN** `paletteToCss` is called with `{"--accent": "expression(alert(1))"}`
- **THEN** the output does NOT contain `expression(` (the entry is dropped)

### Requirement: All 6 security layers SHALL be preserved in the export HTML

The export HTML MUST apply all 6 security layers from the hermes-webui reference: (1) `_content_to_text` preemptive remote-image flattening; (2) `_neutralize_remote_images` post-render regex chokepoint; (3) `_palette_to_css` charset regex dropping `:` `/` quotes and dropping `url()`/`expression()`; (4) `html.escape()` on every user-controlled string; (5) no `<script>`, no `<link>`, no `@import` by construction; (6) no CSP header required (the file has no server response).

#### Scenario: Output HTML contains no script tag

- **WHEN** `renderSessionHtml` is called with any `ExportShape` (even adversarial inputs in messages)
- **THEN** the output HTML does NOT contain any `<script>` element

#### Scenario: Output HTML contains no external link or import

- **WHEN** `renderSessionHtml` is called with any `ExportShape`
- **THEN** the output HTML does NOT contain `<link>` or `@import` (only `<style>` blocks are present)

#### Scenario: Palette injection attempt is dropped

- **WHEN** `renderSessionHtml` is called with a palette value containing `}body{background:red}` (CSS breakout attempt)
- **THEN** the output does NOT contain `}body{` — the entry is dropped by `paletteToCss`

#### Scenario: Remote image URL is inert in output

- **WHEN** `renderSessionHtml` is called with a message containing a remote `image_url`
- **THEN** the output HTML contains no live `<img src="https://...">` tag for that URL — the image appears as an inert `[image: ...]` code span

### Requirement: A new endpoint `GET /api/runs/:id/export` SHALL return a self-contained HTML document

The endpoint SHALL be registered in `src/server.ts` and SHALL return the rendered HTML as `text/html; charset=utf-8` with `Content-Disposition: inline; filename="run-${id.slice(0,8)}.html"` and `Cache-Control: no-store`. The endpoint SHALL NOT require auth (Workshop is local-only) and SHALL NOT change any persisted state.

#### Scenario: Endpoint returns text/html

- **WHEN** the user (or a smoke test) calls `GET /api/runs/:id/export` for a valid run id
- **THEN** the response status is 200 and `Content-Type: text/html; charset=utf-8`

#### Scenario: Filename header present

- **WHEN** the endpoint responds successfully
- **THEN** the `Content-Disposition` header is `inline; filename="run-${id.slice(0,8)}.html"` where `${id.slice(0,8)}` is the first 8 characters of the run id

#### Scenario: No-store caching

- **WHEN** the endpoint responds successfully
- **THEN** the response includes `Cache-Control: no-store`

#### Scenario: Unknown run id returns 404

- **WHEN** the endpoint is called with a run id that does not exist
- **THEN** the response status is 404

#### Scenario: No persisted state changes

- **WHEN** the endpoint is called
- **THEN** no SQLite writes occur (read-only over spans + runs)

### Requirement: A UI button SHALL be present in `RunDetail.tsx` that opens the export URL in a new browser tab

`app/src/components/ExportButton.tsx` SHALL render a button labelled "Export as HTML" (or equivalent) in the run header area of `RunDetail.tsx`. Clicking the button SHALL open `window.open("/api/runs/" + runId + "/export", "_blank")`. The button SHALL NOT use an iframe or in-page preview.

#### Scenario: Export button rendered in run header

- **WHEN** the user opens any run in `RunDetail.tsx`
- **THEN** the run header area renders the Export button

#### Scenario: Clicking opens new tab

- **WHEN** the user clicks the Export button
- **THEN** a new browser tab opens showing the export HTML document; the Workshop tab is not navigated

### Requirement: The export SHALL render Markdown via `markdown-it@^14.x` with `html: false` enabled

`renderMarkdown` SHALL use `markdown-it` configured as `MarkdownIt("commonmark", { html: false, linkify: true, typographer: false }).enable(["table", "strikethrough"])`. Raw HTML inside Markdown source MUST be escaped, not rendered.

#### Scenario: Markdown linkify renders URLs

- **WHEN** a message body contains a bare URL `https://example.com`
- **THEN** the rendered HTML contains an `<a href="https://example.com">https://example.com</a>` element

#### Scenario: Raw HTML inside Markdown is escaped

- **WHEN** a message body contains `<script>alert(1)</script>` inside a Markdown message
- **THEN** the rendered HTML contains the escaped text (`&lt;script&gt;...&lt;/script&gt;`) — no live `<script>` element

### Requirement: Theme and palette theming SHALL be supported via query-string overrides

The export endpoint SHALL accept `?theme=light|dark` and `?palette=<encoded-json>` query parameters. When `theme=dark`, the rendered HTML SHALL include the `:root.dark` override block. When `palette` is provided as a valid JSON object, its sanitised form SHALL be injected into the rendered CSS.

#### Scenario: Theme=light produces light-only output

- **WHEN** the endpoint is called with `?theme=light`
- **THEN** the rendered HTML does NOT contain `:root.dark` and uses the default `:root` palette

#### Scenario: Theme=dark produces dark output

- **WHEN** the endpoint is called with `?theme=dark`
- **THEN** the rendered HTML contains a `:root.dark` override block

#### Scenario: Palette parameter is sanitised

- **WHEN** the endpoint is called with a `?palette={"--accent":"#5a8ab0"}` parameter
- **THEN** the rendered CSS contains `--accent: #5a8ab0`

#### Scenario: Malicious palette is dropped

- **WHEN** the endpoint is called with a `?palette={"--accent":"url(https://x)"}` parameter
- **THEN** the rendered CSS does NOT contain `url(` — the malicious value is dropped

### Requirement: This change SHALL NOT require any SQLite migration or new persisted schema

The change SHALL be a read-only addition: it reads spans + runs via existing queries and adds one HTTP endpoint. No table is added, no column is added, no row is written by the export path.

#### Scenario: Daemon starts without migration

- **WHEN** the daemon boots after this change
- **THEN** no migration runs; the `spans`, `runs`, and `annotations` tables are byte-identical to the pre-change schema

#### Scenario: Export read-only

- **WHEN** the export endpoint handles a request
- **THEN** no `INSERT` / `UPDATE` / `DELETE` SQL statement is issued against any table

### Requirement: All 17 hermes-webui tests SHALL be mirrored in `tests/html-export.test.ts` and pass under `bun test`

The test file SHALL contain at least 17 test cases mirroring the hermes-webui suite: 5+10 palette sanitisation (color-mix/rgb accept, malicious name/value drop, empty input, length cap, url() drop, expression() drop), 6–9 theme override order (dark html class, override after builtin, hostile palette, dark specificity), 11–17 image neutralisation (remote flattened to inert, data URI kept, never active in full HTML, markdown remote neutralised, markdown data URI kept, single-quote+uppercase handled, end-to-end absent).

#### Scenario: Palette sanitisation tests pass

- **WHEN** `bun test tests/html-export.test.ts` is run
- **THEN** all palette sanitisation tests pass (accepts `color-mix` / `rgb`, drops malicious names/values, handles empty input, drops `url()` and `expression()`)

#### Scenario: Theme override tests pass

- **WHEN** `bun test tests/html-export.test.ts` is run
- **THEN** all theme override tests pass (dark html class, override after builtin, hostile palette, dark specificity)

#### Scenario: Image neutralisation tests pass

- **WHEN** `bun test tests/html-export.test.ts` is run
- **THEN** all image neutralisation tests pass (remote flattened, data URI kept, never active in full HTML, markdown variants, edge cases)

#### Scenario: Test count is at least 17

- **WHEN** `bun test tests/html-export.test.ts` is run
- **THEN** the test runner reports at least 17 test cases executed and 0 failures
