# Tasks: add-html-session-export-f005

Implementation checklist for F-005. Decomposed into 3 commit groups per
design D6. Each commit body references `Refs F-005.`

Verification rules (apply to every task):
- `bun run build` MUST succeed after each commit.
- `bun run lint` MUST be clean after each commit.
- `bun x tsc --noEmit` MUST pass after each commit.
- `bun test tests/html-export.test.ts` MUST pass with at least 17 test cases after each commit that touches the helpers.
- No `git push` — local commits only, push requires explicit user instruction.

Reference paths (see `proposal.md`, `design.md`, `specs/html-session-export/spec.md`).
- NEW `src/export/html-export.ts` (~285 LOC)
- NEW `src/export/run-to-export-shape.ts` (~80 LOC)
- NEW `app/src/components/ExportButton.tsx` (~60 LOC)
- NEW `tests/html-export.test.ts` (~290 LOC)
- MODIFY `src/server.ts` (register endpoint, +30 LOC)
- MODIFY `app/src/components/RunDetail.tsx` (mount button, +10 LOC)
- MODIFY `package.json` (add `markdown-it@^14.x`)

---

## 1. Commit 1 — Pure helpers + tests + dependency

- [x] 1.1 In `package.json`, add `"markdown-it": "^14.x"` to `dependencies`. Run `bun install` to update lockfile
- [x] 1.2 Create `src/export/html-export.ts`. Implement the five pure helpers:
  - `function neutralizeRemoteImages(html: string): string` (regex chokepoint; replaces `<img src=non-data:>` with `<code>[image: {escaped-url}]</code>`)
  - `function renderMarkdown(text: string): string` (markdown-it commonmark preset, `html: false`, `linkify: true`; pipe output through `neutralizeRemoteImages`)
  - `function contentToText(content: string | Array<{type: string, text?: string, image_url?: {url: string}}>): string` (OpenAI-style str|list flattening; remote image_url → inert code-span)
  - `function fmtTs(t: number): string` (unix ms → `"%Y-%m-%d %H:%M:%S"`)
  - `function paletteToCss(palette: Record<string, string>): string` (charset regex drops `:` `/` quotes; drops entries with `url()`/`expression()`)
- [x] 1.3 In `src/export/html-export.ts`, implement `function renderSessionHtml(exportShape: ExportShape, theme: "light" | "dark" = "dark", palette?: Record<string, string>): string`. Inline the CSS string (~62 LOC). The CSS uses `:root` for light defaults and `:root.dark` for dark overrides. Drop hermes-specific strings: title default = `exportShape.title` (caller passes run name), footer = `"Exported from Raindrop Workshop"`
- [x] 1.4 Define the `ExportShape` TS interface at the top of `src/export/html-export.ts`: `{ title: string; model?: string; provider?: string; createdAt: number; updatedAt: number; messages: Array<{role: "user" | "assistant" | "system" | "tool"; content: string; ts?: number}> }`
- [x] 1.5 Create `tests/html-export.test.ts`. Port all 17 hermes-webui tests to `bun:test`:
  - 1–5, 10: palette sanitisation (color-mix/rgb accept, malicious name/value drop, empty input, length cap, url() drop, expression() drop)
  - 6–9: theme override order (dark html class, override after builtin, hostile palette, dark specificity)
  - 11–17: image neutralisation (remote flattened, data URI kept, never active in full HTML, markdown remote neutralised, markdown data URI kept, single-quote+uppercase handled, end-to-end absent)
- [x] 1.6 Verify: `bun test tests/html-export.test.ts` runs ≥17 cases with 0 failures
- [x] 1.7 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 1.8 Verify: `rg -n 'function neutralizeRemoteImages|function renderMarkdown|function contentToText|function fmtTs|function paletteToCss|function renderSessionHtml' src/export/html-export.ts` returns exactly one match per function (5 helpers + 1 glue = 6 functions total)
- [x] 1.9 Verify: `rg -n 'Hermes Conversation|hermes-webui|Hermes WebUI' src/export/html-export.ts` returns 0 matches (no hermes-specific strings leaked into TS port)
- [x] 1.10 Commit with message `feat: add HTML session export pure helpers and test suite` (body: `Refs F-005. Ports 5 helpers + renderSessionHtml from hermes-webui to TS with 17-test parity.`)

## 2. Commit 2 — Adapter + endpoint

- [x] 2.1 Create `src/export/run-to-export-shape.ts`. Implement `function loadExportShape(runId: string): Promise<ExportShape>`:
  - Load the run via `getRunWithSpans` (or equivalent helper from `src/db.ts`); resolve runs.metadata.model OR first LLM span's `spans.model` for `model` field; provider from `runs.metadata.provider` (fallback `"openai"` after F-002)
  - Call `extractContext()` from `src/replay.ts:44–74` to flatten LLM spans into an OpenAI-style `messages[]`
  - Map the result to `ExportShape` (title = run.name, createdAt = runs.started_at, updatedAt = runs.last_updated_at)
- [x] 2.2 Handle the `reasoning` field: if any LLM span has `attributes.reasoning`, append it to the assistant message content as a `<details>` block (Markdown-extended HTML). Default: omit
- [x] 2.3 Handle empty / malformed runs: if `extractContext()` returns no messages, return an `ExportShape` with an empty `messages` array (the renderer still produces a valid HTML document with a "No messages" placeholder)
- [x] 2.4 In `src/server.ts`, register `app.get("/api/runs/:id/export", async (c) => { ... })`. Handler:
  - Validate `id` parameter (non-empty); return 404 if `loadExportShape(id)` throws
  - Read query params: `theme` (`"light" | "dark"`, default `"dark"`) and `palette` (JSON-encoded object, optional)
  - Call `renderSessionShape(exportShape, theme, parsedPalette)` (or equivalent)
  - Return `c.text(html, 200, { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": \`inline; filename="run-${id.slice(0,8)}.html"\`, "Cache-Control": "no-store" })`
- [x] 2.5 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 2.6 Verify: `rg -n '/api/runs/:id/export' src/server.ts` returns exactly one match (the registration line)
- [ ] 2.7 Smoke test: `curl -sS http://localhost:5899/api/runs/<known-run-id>/export | head -20` returns HTML starting with `<!DOCTYPE html>` (do NOT restart daemon without explicit user OK; use a running daemon)
- [ ] 2.8 Smoke test: `curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:5899/api/runs/nonexistent-id/export` returns `404` and `text/html; charset=utf-8`
- [x] 2.9 Commit with message `feat: add GET /api/runs/:id/export endpoint` (body: `Refs F-005. Adapter uses extractContext() for run→ExportShape mapping.`)

## 3. Commit 3 — UI button

- [x] 3.1 Create `app/src/components/ExportButton.tsx`. Component signature: `function ExportButton({ runId, theme }: { runId: string; theme?: "light" | "dark" }): JSX.Element`. Renders a single button labelled "Export as HTML". Click handler: `window.open(\`/api/runs/${runId}/export${theme ? \`?theme=${theme}\` : ""}\`, "_blank")`
- [x] 3.2 Optional: read `localStorage.getItem("workshop.theme")` in `ExportButton.tsx` if `theme` prop is not provided; defensive parse (treat malformed JSON as `"dark"`)
- [x] 3.3 In `app/src/components/RunDetail.tsx`, locate the run header area (around the existing run-name display) and mount `<ExportButton runId={run.id} theme={...} />`. Pass through the existing theme prop if available, or let the button read `localStorage`
- [x] 3.4 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [ ] 3.5 Smoke test: open a run in `RunDetail.tsx`, confirm the "Export as HTML" button is visible in the header; click it and confirm a new browser tab opens with the rendered export HTML
- [x] 3.6 Verify: `rg -n 'ExportButton' app/src/components/RunDetail.tsx app/src/components/ExportButton.tsx` returns the expected import + usage
- [x] 3.7 Commit with message `feat: add Export as HTML button to RunDetail header` (body: `Refs F-005. Closes F-005.`)
