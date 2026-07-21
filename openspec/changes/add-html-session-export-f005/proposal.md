## Why

Today Workshop lets a user inspect a run in the browser and inspect each span in detail, but there is no way to share a run with someone who does not have Workshop installed — no static export, no printable artefact, no "send me this trace" link. Sharing a useful trace currently means screen-shotting tabs or copying JSON into Slack, both of which lose the rendering (Markdown, code blocks, image safety) that makes a trace readable.

This change adds a "Export as HTML" capability: every run gets a stable, self-contained HTML document that renders its messages in a readable, themed view with the same security hardening (no remote image fetch, no `url()` exfil, no script injection) as Workshop's in-app rendering. The HTML is opened in any browser, works offline, and never calls back to the daemon.

The design and security primitives are not invented here. There is an existing reference implementation in `~/hermes-webui/api/session_export_html.py` (297 LOC) plus a 17-test security suite (`tests/test_session_export_html_palette.py`) that this change ports to TypeScript verbatim. Audit confirms 5 of 6 helpers are pure (no Hermes coupling) and all 17 tests are hermes-agnostic.

`ai-docs/PLAN.md` F-005 (L18–41) tracks this feature.

## What Changes

- **New module** — `src/export/html-export.ts` (~285 LOC) implementing the five pure helpers (`neutralizeRemoteImages`, `renderMarkdown`, `contentToText`, `fmtTs`, `paletteToCss`) plus `renderSessionHtml(exportShape, theme, palette)` and the inline CSS string. Pure functions, no I/O, no daemon coupling, fully unit-testable.
- **New adapter** — `src/export/run-to-export-shape.ts` (~80 LOC) that loads a run via `getRunWithSpans` (`src/db.ts`-style query), calls the existing `extractContext()` helper from `src/replay.ts:44–74` to flatten spans into an OpenAI-style `messages[]`, and produces an `ExportShape` object suitable for `renderSessionHtml`.
- **New endpoint** — `GET /api/runs/:id/export` registered in `src/server.ts` (mirrors the existing `/api/runs/:id/outline` shape: simple `:id` param, no auth, no body). Returns `text/html; charset=utf-8` with `Content-Disposition: inline; filename="run-${id.slice(0,8)}.html"` and `Cache-Control: no-store`. Response is the rendered HTML string.
- **New UI button** — `app/src/components/ExportButton.tsx` (~60 LOC) placed in the run header area of `RunDetail.tsx` (or `Overview.tsx`). Click opens the export URL in a new browser tab via `window.open(URL, "_blank")`. No preview, no iframe — just "open the HTML".
- **New dep** — `markdown-it@^14.x` (npm, zero runtime deps, ~50KB). Bundled by Vite into the daemon's server-side module.
- **New tests** — `tests/html-export.test.ts` (~290 LOC) mirroring the 17 hermes-webui tests: 5+10 palette sanitisation, 6–9 theme override order, 11–17 image neutralisation. All 17 must pass before merge.

### Adapt-vs-reimplement decision (per audit recommendation: REIMPLEMENT)

Two options were on the table:
- **Option A — Re-implement in TS.** Port the helpers, write new tests. ~400–500 LOC TS.
- **Option B — Adapt by wrapping the Python script.** Spawn a subprocess on each `/export` request. ~80 LOC TS + a Python runtime dependency.

**Decision: Option A (re-implement).** Rationale (full table in `design.md` D1):
1. **Bun-only stack purity.** Workshop is a Bun daemon with a Vite/React UI. Adding CPython as a runtime dependency for one feature violates the stack's surface area and breaks `bun run dev` for any user without a Python interpreter.
2. **Test parity.** All 17 hermes-webui tests are hermes-agnostic; they translate 1:1 to `bun:test`. Re-implementation means we own the test suite.
3. **Security invariants in TypeScript types.** The `_palette_to_css` charset regex and the `_neutralize_remote_images` chokepoint are easier to audit and harden when expressed in TS (with strict typing of the `ExportShape` and `Palette` shapes).
4. **Tighter integration with `extractContext()`.** The adapter calls `extractContext()` directly rather than marshalling spans into a Python subprocess via JSON.
5. **No cross-language debugging.** When a rendering bug shows up in production, the developer stays in one toolchain.

Option B was rejected on stack-purity and test-ownership grounds. The estimated LOC delta (A: 400–500, B: 80 + Python dep) is reversed by the cost of carrying a Python dep + subprocess lifecycle in CI/release.

### Scope

Files in scope (NEW):
- `src/export/html-export.ts` (NEW, ~285 LOC)
- `src/export/run-to-export-shape.ts` (NEW, ~80 LOC)
- `app/src/components/ExportButton.tsx` (NEW, ~60 LOC)
- `tests/html-export.test.ts` (NEW, ~290 LOC)

Files in scope (MODIFY):
- `src/server.ts` — register `app.get("/api/runs/:id/export", ...)` handler (~30 LOC added)
- `app/src/components/RunDetail.tsx` (or `Overview.tsx`) — mount `<ExportButton />` in the run header
- `package.json` — add `markdown-it@^14.x` to `dependencies`

Files in scope (READ-ONLY):
- `src/replay.ts:44–74` — call `extractContext()` to flatten spans into OpenAI-style messages
- `src/db.ts` (or wherever `getRunWithSpans` lives) — call to load the run

### Scope OUT

- **Hermes-webui code (`~/hermes-webui/`).** Reference only; do not modify, copy, or symlink. The Python module is not a dependency.
- **PDF export.** Out of scope; would need a headless browser or a PDF library. Future follow-up.
- **Markdown export.** Out of scope. HTML is the chosen format per PLAN.md F-005. If Markdown is later desired, the helper structure (`_content_to_text`, `_render_markdown`) makes a follow-up small.
- **Cloud upload / S3 / shared link service.** Workshop is local-only (`ai-docs/AGENTS.md`). Export is offline HTML; sharing happens out-of-band (file copy, email).
- **Inline images.** Remote image URLs are intentionally neutralised (per `_neutralize_remote_images` security model). Embedding images would require either data-URIs at ingest (out of scope) or fetching on export (security risk). Inline images are out of scope.
- **Session concatenation / multi-run export.** One run = one HTML file. A "session" with multiple runs is out of scope; users can open multiple tabs.
- **Upstream-owned files** (`Docs/`, root `AGENTS.md`, root `README.md`) — do not touch.
- **F-002..F-004 changes.** Each is a separate Feature with its own OpenSpec change; do not bundle.

## Capabilities

### New Capabilities
- `html-session-export`: Server-side rendering of a run into a self-contained, security-hardened HTML document with Markdown rendering, theme + palette theming, no remote image fetch, and a UI button in `RunDetail` that opens the export in a new browser tab.

### Modified Capabilities
- (none — no pre-existing spec to delta)

## Impact

- **Code surface:** ~400–500 net LOC in 4 new files + ~30 LOC in `src/server.ts` + ~10 LOC in `RunDetail.tsx` to mount the button.
- **API:** adds `GET /api/runs/:id/export` returning `text/html`. No new request shape; no auth; matches existing `/api/runs/:id/outline` style.
- **Dep:** `markdown-it@^14.x` (npm, MIT-licensed, zero runtime deps, ~50KB gzipped).
- **Schema:** no migration. Reads only.
- **Tests:** new test file `tests/html-export.test.ts` mirrors all 17 hermes-webui tests, runnable via `bun test`. All 17 must pass.
- **Security:** the export HTML NEVER executes JavaScript, NEVER fetches external resources except via the user's explicit `<a>` clicks on rendered Markdown links, and applies the `_palette_to_css` charset regex that drops `url()`, `expression()`, `}`, `:`, `/`, quote characters from palette names and values. Image URLs are flattened to inert `<code>[image: {escaped-url}]</code>` via `_neutralize_remote_images`.
- **Plugin coupling:** none. Workshop can produce the export today without any companion-plugin support.
- **Bundle:** `markdown-it` is bundled into the daemon-side bundle (server-side rendering, not browser). No impact on `app/` bundle size.
- **Docs:** `ai-docs/PLAN.md` F-005 (L18–41) marked done on merge.
