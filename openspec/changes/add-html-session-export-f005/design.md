## Context

Workshop today has no export feature. A user can inspect a run in the browser (`RunDetail.tsx`) and inspect each span (`SpanDetail.tsx`), but cannot share a run with someone who lacks a running Workshop daemon. Sharing requires screen-shots or pasted JSON — both lose the rendering (Markdown, code blocks, image safety) that makes a trace readable.

A reference implementation already exists in `~/hermes-webui/api/session_export_html.py` (297 LOC) plus a 17-test security suite (`tests/test_session_export_html_palette.py`, 270 LOC). The audit confirmed that 5 of the 6 helpers are pure (no hermes coupling) and all 17 tests are hermes-agnostic.

Pure helpers (1:1 portable to TS):

- `_neutralize_remote_images(rendered_html) -> str` (L28–56, 30 LOC): regex chokepoint that replaces `<img src=non-data:>` with `<code>[image: {escaped-url}]</code>`. Critical security primitive.
- `_render_markdown(text) -> str` (L59–69, 11 LOC): `markdown_it` commonmark preset + neutralise.
- `_content_to_text(content) -> str` (L71–103, 32 LOC): OpenAI-style `str | list` flattening; remote `image_url` → inert code-span.
- `_fmt_ts(t) -> str` (L105–109, 6 LOC): unix ts → `"%Y-%m-%d %H:%M:%S"`.
- `_palette_to_css(palette) -> str` (L186–217, 33 LOC): sanitises `{css-var: value}` dict; regex on name/value charset drops `url()`, `expression()`, `}`, `:`, `/`, quotes.

`render_session_html(session, theme="dark", palette=None)` (L220–297, 78 LOC) is pure glue that reads the session fields and concatenates `<!DOCTYPE html>`.

Hermes-specific glue (NOT ported):

- Title `"Hermes Conversation"` → Workshop's run.name fallback.
- Footer `"Exported from Hermes WebUI"` → `"Exported from Raindrop Workshop"`.
- Session dict shape (`session_id`, `model`, `model_provider`, `created_at`, `updated_at`, `messages[]`) → adapted to Workshop's run + spans shape.
- System-role filter (L239) → drop (Workshop has no system message concept; the LLM span's `view.systemPrompt` is its analog).
- Reasoning field (L249–255) → optional via span `attributes.reasoning`.
- Tool role label (L116) → Workshop has TOOL_CALL spans, not tool messages.

CSS (~62 LOC inline) drives light/dark theming via `:root` + `:root.dark`. Warm gold + teal/green accents. **Workshop ships its own palette** matching the daemon's existing cool blue tokens, not the warm gold from hermes-webui.

Backend / data shape:

- `src/replay.ts:44–74` `extractContext()` flattens spans into an OpenAI-style `messages[]` (filters `s.span_type.includes("LLM")`, reads `best.normalized.messages`). Reused by the export adapter.
- `runs.metadata.model` (or first LLM span's `spans.model`) supplies the model name.
- `runs.started_at` / `last_updated_at` (ms epoch) → either convert at the boundary or change `_fmt_ts` to accept ms.
- No first-class `messages` table; export is read-only over spans.

Constraints inherited (per `ai-docs/AGENTS.md` and `ai-docs/HANDOFF.md`):
- Local-only debugger; no cloud deps.
- One Feature = one commit per F-NNN (F-005 ships as 3 commits, see D2).
- `ai-docs/PLAN.md` F-005 (L18–41) is the source of truth for scope.
- Upstream-owned files (`Docs/`, root `AGENTS.md`, root `README.md`) MUST NOT be edited.
- Never restart daemon without explicit OK; never `git push` without explicit instruction.

## Goals / Non-Goals

**Goals:**
- Re-implement the 5 pure helpers and the `renderSessionHtml` glue in TypeScript, in `src/export/html-export.ts`.
- Add a server endpoint `GET /api/runs/:id/export` returning a self-contained HTML document.
- Mount an `<ExportButton />` in the run header that opens the export URL in a new browser tab.
- Mirror all 17 hermes-webui tests as `tests/html-export.test.ts`.
- Preserve all 6 security layers (CSS sanitisation, image neutralisation, html.escape on every user-controlled string, no `<script>` / `<link>` / `@import`, no CSP header needed since static file has no server response, palette charset regex drops `url()`/`expression()`/`}`/colon/slash/quote).

**Non-Goals:**
- Subprocess wrapping of the Python script.
- PDF export.
- Markdown export.
- Cloud upload or shared-link service.
- Inline image embedding (remote images stay neutralised).
- Multi-run / session export.
- Modifying hermes-webui.
- Upstream-owned file edits.

## Decisions

### D1 — Adapt vs re-implement: RE-IMPLEMENT in TypeScript. (load-bearing)

Five reasons:

1. **Bun-only stack purity.** Adding CPython as a runtime dependency for one feature violates the daemon's surface area and breaks `bun run dev` for any user without a Python interpreter.
2. **Test parity.** All 17 hermes-webui tests are hermes-agnostic; they translate 1:1 to `bun:test`. Re-implementation means we own the test suite.
3. **Security invariants in TypeScript types.** The `_palette_to_css` charset regex and the `_neutralize_remote_images` chokepoint are easier to audit and harden when expressed in TS with strict typing of `ExportShape` and `Palette`.
4. **Tighter integration with `extractContext()`.** The adapter calls `extractContext()` directly rather than marshalling spans into a Python subprocess via JSON.
5. **No cross-language debugging.** When a rendering bug shows up in production, the developer stays in one toolchain.

**Alternatives considered:**
- **Adapt (Option B):** spawn a subprocess on each `/export` request. ~80 LOC TS + a Python runtime dep. Rejected on stack-purity and test-ownership grounds.
- **Hybrid (compile the Python to a Bun-compatible module via Transcrypt / Pyodide):** rejected on complexity (one extra toolchain, one extra build step) for marginal LOC savings.

### D2 — Module layout: `src/export/{html-export,run-to-export-shape}.ts`. (reversible)

```
src/export/
  html-export.ts          # pure: 5 helpers + renderSessionHtml + CSS string
  run-to-export-shape.ts  # I/O: load run via getRunWithSpans + extractContext → ExportShape
```

The split mirrors the hermes-webui layout (pure helpers vs session-shape glue) and keeps the security-sensitive pure helpers unit-testable without DB or HTTP fixtures. `run-to-export-shape.ts` is the only file that touches the DB.

`app/src/components/ExportButton.tsx` lives in the React tree because it has no server-side concerns.

**Alternatives considered:**
- One monolithic `src/export.ts` — rejected: mixes pure helpers with DB I/O, blocks unit testing the helpers without DB fixtures.
- Put the pure helpers in `app/src/utils/` and the adapter in `src/server.ts` — rejected: `app/` is for client code; the pure helpers are needed server-side (the daemon renders the HTML), so `src/export/` is the right home.

### D3 — Endpoint: `GET /api/runs/:id/export` returning `text/html`. (load-bearing)

Mirrors the existing `/api/runs/:id/outline` shape (simple `:id` param, no body, no auth). Response headers:
- `Content-Type: text/html; charset=utf-8`
- `Content-Disposition: inline; filename="run-${id.slice(0,8)}.html"`
- `Cache-Control: no-store`

The daemon computes the export on each request (no caching layer needed; `extractContext()` and `renderSessionHtml` are cheap relative to the cost of caching invalidation across schema changes).

**Alternatives considered:**
- `POST /api/runs/:id/export` with body for theme/palette overrides — rejected: query-string params (`?theme=dark&palette=...`) cover the same surface with less code.
- Pre-render to disk on a `Refresh export` action — rejected: complicates the daemon's file surface; runtime rendering is fast enough.

### D4 — Reuse `extractContext()` from `src/replay.ts:44–74`. (load-bearing)

The export adapter calls `extractContext()` to flatten spans into an OpenAI-style `messages[]`. This reuses the exact same code path that the existing replay UI uses, which means: (1) the export reflects the same conversation as what the user sees in the app, (2) any future fix to `extractContext()` automatically benefits the export, (3) there's no parallel code path that can drift.

The adapter then maps `extractContext()` output to the `ExportShape` (renaming fields, adding `created_at` / `updated_at`, joining with `runs.metadata.model`).

**Alternatives considered:**
- Walk spans directly in the adapter without `extractContext()` — rejected: duplicates the LLM-filtering logic that lives in `src/replay.ts`. Single source of truth wins.
- Add a new method on the `replay.ts` module specifically for export — rejected: the existing `extractContext()` is exactly the right shape; no need for a sibling.

### D5 — Markdown rendering: `markdown-it@^14.x`. (load-bearing)

npm package, MIT-licensed, zero runtime deps, ~50KB gzipped. Used in the helper `renderMarkdown` with `MarkdownIt("commonmark", { html: false, linkify: true, typographer: false }).enable(["table", "strikethrough"])`. The `html: false` setting prevents raw HTML in Markdown source from being rendered as HTML — defence-in-depth alongside `_neutralize_remote_images`.

**Alternatives considered:**
- `marked` — rejected: `markdown-it` is the same library hermes-webui uses (parity is valuable); `marked` has historically had more XSS regressions.
- Custom regex-based Markdown — rejected: security risk; reinventing wheel; ~10x the LOC.
- No Markdown (just plain text) — rejected: defeats the readability goal of the export.

### D6 — Commit decomposition: 3 commits inside F-005. (load-bearing)

Per the fork's "one Feature = one commit" convention, F-005 ships as 3 commits:

1. **Commit 1 — Pure helpers + tests.** `src/export/html-export.ts` + `tests/html-export.test.ts` + `package.json` (markdown-it dep). All 17 tests passing. No server integration. ~575 LOC added.
2. **Commit 2 — Adapter + endpoint.** `src/export/run-to-export-shape.ts` + `GET /api/runs/:id/export` route in `src/server.ts`. ~110 LOC added.
3. **Commit 3 — UI button.** `app/src/components/ExportButton.tsx` + mount in `RunDetail.tsx`. ~70 LOC added.

**Alternatives considered:**
- 1 monolithic commit (575 LOC) — rejected: too large for atomic review.
- 5 commits (one per helper) — rejected: helpers are interdependent; splitting them creates intermediate commits where the test suite doesn't compile.

## Risks / Trade-offs

- **Risk:** `markdown-it` vulnerability discovered. **Mitigation:** version pinned to `^14.x`; renovate/dependabot updates keep it current; the `html: false` setting + `_neutralize_remote_images` chokepoint limit the blast radius of any markdown parser issue.
- **Risk:** CSS palette injection via `paletteToCss` bypass (charset regex misses an exotic vector). **Mitigation:** the 17 hermes-webui tests cover `url()`, `expression()`, `}body{`, charset edge cases; the same tests run against the TS port; any regression is caught at `bun test`.
- **Risk:** `_fmt_ts` accepts ms epoch but hermes-webui's accepts seconds — signature drift on port. **Mitigation:** write the TS signature to accept `number` (ms), convert hermes-style seconds callers explicitly; tests cover both.
- **Risk:** `extractContext()` doesn't include all LLM spans (e.g. nested sub-agent LLM calls under F-003). **Mitigation:** F-005 exports the top-level trace; nested sub-agent rendering is a follow-up if users need it (the export already gets the canonical SubAgent list from F-003's API response and could render a sub-agent section later).
- **Risk:** Endpoint abuse — a malicious user calls `/api/runs/:id/export` thousands of times to DoS the daemon. **Mitigation:** Workshop is local-only (single user); no rate limiter needed. If Workshop ever ships in a multi-user context, add rate limiting then.
- **Trade-off:** ~400–500 LOC for a feature users may use rarely. Justified by security model: rendering arbitrary user content into HTML is a high-risk surface that earns its LOC budget.

## Migration Plan

No data migration. UI-only addition. Rollback = revert the affected commit(s). No daemon restart needed for `bun run dev` to pick up the new module + endpoint (Hono hot-reload). User's standing rule "never restart the daemon without explicit OK" still applies.

## Open Questions

- Should the export include the canonical `SubAgent` shape from F-003 (a "Sub-agents in this run" section near the top)? **Default proposal:** no for this change; out of scope. Could be a small follow-up under F-006 ("Export enhancements"). Tracked in PLAN.md as a backlog item.
- Should the export theme honour the user's `workshop.theme` localStorage value (so dark-mode users get a dark export)? **Default proposal:** yes — read `localStorage.getItem("workshop.theme")` in `ExportButton.tsx` (or pass via `?theme=dark` query param). Trivial to add; small spec addition if needed.
- Should the export offer a "tokens + cost" summary table? **Default proposal:** no — out of scope for F-005; users wanting cost analysis stay in the app.
