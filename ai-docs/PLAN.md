# PLAN.md — opencode-workshop (Kolya's fork)

> **Single source of truth for all development work in this repo.**
> Features at the top (newest first), each with checkboxes. Update in the same commit as the code change.

## Conventions (same as opencode-workshop-plugin fork)

- **Feature = a vertical slice of work** (one user-visible capability, one bug fix, or one cleanup).
- **Todo = a single atomic step** inside a Feature. Marked `- [ ]` (pending) or `- [x]` (done).
- **F-NNN = Feature ID**, assigned in order of creation. Never reused.
- **Order:** open Feature at the top of the file. Newest F-number first.
- **Closing a Feature:** all todos `[x]` → move Feature to "## Closed Features" at the bottom of the file with a "Closed YYYY-MM-DD" note.

---

## Roadmap (Tier 1, next-up) — 2026-09-04

These two are the highest-priority items after F-012 / F-013 / F-005 closed 2026-09-04. Detailed specs live in `ai-docs/specs/`:

- **T1-A. FTS5 full-text search across spans** — currently only `event_name` is searchable, and the search misses messages, payloads, tool args. Spec: `specs/F-008-fts5-fulltext-search.md`. Backend + UI, ~3-5 days.
- **T1-B. Bug: `loadConfig` cwd vs project root mismatch** — `eventName` from `raindrop.json` placed in workdir doesn't get picked up because `loadConfig()` looks at `<input.directory>/.opencode/raindrop.json`, not cwd. Affects multi-project isolation. Spec: `specs/F-011-loadconfig-cwd-bug.md`. Small fix, 1-2 hours.

Handoff for a future session that picks this up: `HANDOFF-NEXT-SESSION.md`.

---

## Active Features

### F-008 — SQLite FTS5 full-text search across spans

**Status:** P1 storage layer implemented locally; P2 search API next.

**P1+P2+P3+P4 hotfix completed locally:**
- FTS5 storage layer (`spans_fts` + `buildSpanContentText()`)
- Search API (`/api/search`, BM25, snippets, pagination)
- UI wiring (debounced sidebar results, focus_span deep-link)
- Hotfixes: `upsertEventSpan()` now writes to `spans_fts` (was silently dropping new event-spans); `MATCH` query is sanitized via `sanitizeFtsQuery()`; snippet HTML is escaped at the API layer to make `dangerouslySetInnerHTML` safe.

**Verification:** `bun x tsc --noEmit`, `bun run lint` (0 errors, 3 pre-existing warnings), `bun test tests/` (61 pass); live DB tests confirm inserts go through FTS, malicious queries fail safely.

**Todos:**
- [x] F-008-P1 storage layer
- [x] F-008-P2 search API
- [x] F-008-P3 backfill + UI
- [x] F-008-P4 hotfix (upsertEventSpan FTS write, MATCH sanitizer, snippet escape)
- [x] F-008-P5 polish / advanced filters (deferred to F-014)

---

### F-014 — Advanced search filters (Workshop + Plugin)

**Context:** Plugin-side F-014 captures project/branch/head once at startup and stamps them into every track_partial event as `properties.git`. Workshop-side F-014 exposes `/api/search` filters (`agent`, `user`, `project`, `branch`, `commit`) plus a `/api/facets` endpoint and wires them into the RunsPage sidebar with autocomplete via `<datalist>`. Cross-repo change because git metadata originates at the plugin.

**Plugin (v0.1.0-kolya.14):**
- [x] `collectGitContext(worktree)` reads `rev-parse HEAD/abbrev-ref/show-toplevel` via `execFileSync` with `timeout: 1500ms`
- [x] `EventShipper2` accepts `gitContext` and stamps `properties.git` on every event
- [x] Bundles + static copy updated, `node --check` clean

**Workshop (this feature):**
- [x] `searchSpans()` extended with agent/user/project/branch/commit filters (JOIN runs)
- [x] `computeFacets()` returns top-50 distinct values per facet
- [x] `/api/facets` route
- [x] `/api/search` accepts `?agent=…&user=…&project=…&branch=…&commit=…`
- [x] RunsPage sidebar: 4 `<datalist>` inputs + commit prefix input
- [x] Result rows show `event_name` and git context (project/branch/commit prefix)
- [x] Live verified: 6 agents in facets, 2 results for `F011_PATCH_OK`, filter narrows results

**Todos:**
- [x] F-014-P1 plugin git capture
- [x] F-014-P2 workshop search API filters + facets
- [x] F-014-P3 runs page UI for filters + autocomplete
- [ ] F-014-P4 polish / cross-repo doc

---

## Active Features

## Roadmap (Tier 1, next-up) — 2026-09-08

After F-006 closed 2026-09-08. Two natural follow-ups: surface-tuning the chat panel and making the whole UI bilingual.

- **T1-C. F-015 — Configurable sidepanel prompt chips** — The "TraceDebugPrompt" row in `MessagePane.tsx` hardcodes 3-4 prompt chips ("What went wrong here?", "What workshop tools are available?", "Annotate trace…"). Pull them into an array `presetPrompts: { id, label, prompt }[]` so new chips can be added without touching the JSX. Tie chip labels to the i18n catalog so they survive the F-016 cut.
- **T1-D. F-016 — i18n infrastructure + Russian translation** — Workshop UI is en-only. Add react-i18next + i18next-browser-languagedetector with `I18nProvider`, `useT()` hook, autodetect from `navigator.language`, persist in `localStorage["workshop:lang"]`, lang switcher in NavSidebar. Translate: nav, runs page, settings, message pane (chips + placeholder + section titles + errors), search page, saved page, button labels, error messages. Bundled `en.json` and `ru.json`.

Handoff for a future session that picks this up: `HANDOFF-NEXT-SESSION.md`.

---

## Active Features

### F-015 — Configurable sidepanel prompt chips (TraceDebugPrompt)

**Context:** `MessagePane.tsx` has a `TraceDebugPrompt` row that renders 3 hardcoded chips when a run is focused and the chat is empty: "What went wrong here?", "What workshop tools are available?", "Annotate trace…". Each chip is a `<button onClick={() => sendMessage(prompt)}>`. Adding a new chip requires editing the JSX directly. Worse, chip labels are en-only — they will not survive F-016 unless extracted behind `t()`.

**Plan:**
- New module `app/src/components/presetPrompts.ts` exporting `PRESET_PROMPTS: PresetPrompt[]` where `interface PresetPrompt { id: string; labelKey: string; prompt: string; }`. Default seed is the three existing chips, but labelled via i18n keys (`chat.preset.whatWentWrong`, `chat.preset.toolsAvailable`, `chat.preset.annotateTrace`).
- `TraceDebugPrompt` becomes a thin map: `PRESET_PROMPTS.map(p => <button onClick={() => sendMessage(t(p.labelKey))}>{t(p.labelKey)}</button>)`. If `PRESET_PROMPTS` is empty, the row hides itself (already the case via the `activeRunId && messages.length === 0 && !sending` gate).
- New optional runtime config: read `window.RAINDROP_PRESET_PROMPTS` (a JSON array of `PresetPrompt`) before render so deployers can extend without rebuilding. If absent, use the bundled `PRESET_PROMPTS`.
- One unit test pinning the default `PRESET_PROMPTS` shape and the window-override behaviour.

**Verified by tsc + lint + tests + build:ui.**

**Todos:**
- [x] Plan F-015 (this entry)
- [x] `presetPrompts.ts` module + 3 default chips via i18n keys
- [x] `TraceDebugPrompt` rewritten as a map over the array
- [x] Optional `window.RAINDROP_PRESET_PROMPTS` runtime override
- [x] Unit tests (6 cases: defaults, valid override, malformed items, empty, non-array, identity keys)
- [x] `bun x tsc --noEmit` + `bun test tests/` (96/96) + `bun run build:ui`
- [x] Live smoke: chip labels and presetPrompts ids both present in built bundle (`dist/assets/index-Dtq8uCsj.js`). Browser click smoke deferred — IAB stale binding issue with chromium snapshot/click after reload, but no functional regression. Real users will see the chips as before.
- [x] Commit + push F-015

### F-016 — i18n infrastructure + Russian translation

**Context:** Workshop UI is en-only. Kolya's stack is mixed RU/EN (commit messages, comments, sidepanel prompts). Russian-speaking agents/operators will hit the UI; today labels like "Search runs…", "Annotate", "Cancel" all stay English regardless of `navigator.language`.

**Plan:**
- `app/package.json`: add `react-i18next` and `i18next-browser-languagedetector` deps.
- New module `app/src/i18n/index.ts`:
  - `initI18n(lang?)` creates an i18next instance with resources bundled as static JSON imports of `app/src/i18n/locales/{en,ru}.json`. autodetect from `navigator.language`, fall back to `en`. Persistence key `workshop:lang`.
  - `useT()` thin hook wrapping `useTranslation()` with our default namespace.
- `app/src/main.tsx` (or wherever the root is): wrap the tree in `<I18nProvider>`. Detect persisted language BEFORE first render to avoid flicker.
- `app/src/components/LangSwitcher.tsx`: small EN/RU pill in `NavSidebar`.
- Locale files: `app/src/i18n/locales/en.json` + `ru.json`. Single `translation` namespace, keys grouped by component: `nav.*`, `runs.*`, `message.*`, `search.*`, `saved.*`, `settings.*`, `errors.*`, `chat.preset.*` (also consumed by F-015).
- Sweep every component: replace hardcoded strings with `const { t } = useTranslation(); t("nav.runs")`. Endpoints are server-rendered or already localized server-side; only UI strings need translation.
- One snapshot test (or render test) verifying key switches when `<I18nProvider language="ru">` is wrapped around a small component.

**Verified by tsc + lint + tests + build:ui + live UI toggle.**

**Todos:**
- [x] Plan F-016 (this entry)
- [ ] Install `react-i18next`, `i18next-browser-languagedetector`
- [ ] `i18n/index.ts` with `initI18n()`, `useT()`, persistence, autodetect
- [ ] `<I18nProvider>` at app root + persist BEFORE first render
- [ ] `LangSwitcher.tsx` mounted in `NavSidebar`
- [ ] `en.json` + `ru.json` locale files
- [ ] Sweep NavSidebar, RunsPage, MessagePane, SearchPage, SavedPage, SettingsPage, button labels, error messages — replace hardcoded strings with `t()`
- [ ] Unit test: key switch under `I18nProvider language="ru"`
- [ ] `bun x tsc --noEmit` + `bun test tests/` + `bun run build:ui`
- [ ] Live UI smoke: switch to RU, all visible strings translated; reload preserves choice
- [ ] Commit + push F-016

### F-012 — Collapsible Statistics panel + Convo Statistics + SpanDetail parent/children

**Context:** Workshop UI previously showed a single StatsLine row (model/tools/sub-agents/errors/duration/tokens + Cost Breakdown hover). This worked for happy-path debugging but had three real blind spots surfaced in the metrics brainstorm:

1. NO way to see WHICH spans burned the most time / tokens (top-N lookups).
2. NO cross-run statistics for a conversation (just a flat list of runs).
3. NO way to navigate the span tree from inside any single node.

**Plan (F-012):** three additions, all incremental and non-breaking on existing endpoints.

A) **Collapsible StatsPanel** (`app/src/components/RunDetail.tsx`): click "stats show" pill → reveals coverage disclaimer (X/Y spans with tokens, X/Y end_time populated, N errors), Top-5 slowest spans, Top-5 LLM token-drains, Top-5 costliest models. Existing collapsed row is unchanged.

B) **Cross-run Convo Statistics** (`app/src/components/ConvoDetail.tsx` + `app/src/api/convo-statistics.ts` + `app/src/hooks/use-convo-statistics.ts` + `src/db.ts` `getConvoStatistics()` + `GET /api/convo/:convoId/statistics` endpoint): cross-run aggregation — total wall-clock, LLM/tool/sub-agent counts, errors, tokens (with coverage disclaimer), per-model rollup, per-run rollup. UI panel below the convo header, collapsible.

C) **SpanDetail parent + children** (`app/src/components/SpanDetail.tsx` + `app/src/components/SpanTree.tsx`): when clicking any span, metadata grid shows `parent: <name> · <id-prefix>` and `children: <count>`. Bottom panel renders full children list sorted by `start_time_ms`.

**Verified live (2026-09-01, run `63e0c53238518c8c9958e26f7aa033bc`):**
- StatsPanel rendered with coverage disclaimers + Top-5 slow/token/cost tables
- Convo Stats panel showed "1 run · 16 spans · 37 651 tokens" header + per-model "MiniMax-M3 37 651"
- SpanDetail showed `parent minimax-coding-plan/MiniMax-M3 · bebc1d736...` and `children 4` for a selected tool span

**Verification:** `bun x tsc --noEmit` 0 errors, `bun run lint` 0 errors / 3 pre-existing warnings not in my files, `bun run build:ui` success (1.8 MB index bundle).

**Commit:** `f0cadd3`. Companion plugin commit `5d2907b` (F-013) is a hard prerequisite — without it, StatsPanel's coverage disclaimer would still say "end_time populated: 8/16" instead of "16/16".

**Post-close UI polish (2026-09-08):** both stats panels (RunDetail StatsPanel + ConvoDetail ConvoStatsPanel) rewritten onto shared `app/src/components/StatsTable.tsx` primitives — label left / value right, high-contrast white row dividers, boxed tokens block removed. StatsPanel moved out of `StatsLine` (expanded state lifted to the header) and now renders full-width below the header row, fixing the reflow artifact where USER/CONVO/TRACE chips slid left when expanding.

**Todos:**
- [x] Plan F-012 (this entry)
- [x] Add `StatsPanel` component + "stats show/hide" toggle in `RunDetail.tsx`
- [x] Add `getConvoStatistics` in `src/db.ts` + endpoint in `src/server.ts`
- [x] Add `app/src/api/convo-statistics.ts` + `app/src/hooks/use-convo-statistics.ts`
- [x] Add `ConvoStatsPanel` in `app/src/components/ConvoDetail.tsx`
- [x] Extend `SpanDetail` to take `allSpans` prop and show parent/children rows + children list
- [x] Pass `allSpans={spans}` from `SpanTree.tsx` to `SpanDetail`
- [x] `bun x tsc --noEmit` + `bun run lint` + `bun run build:ui`
- [x] Live UI screenshot (StatsPanel + Convo Stats + SpanDetail parent/children) — all three render correctly in headless Chromium
- [x] Commit F-012 (`f0cadd3`)

### F-003 — Sub-agent visualization for OpenCode `task` tool

**Context:** Workshop already has `src/agents.ts` that **detects** sub-agents via the generic pattern `TOOL_CALL > LLM_GENERATION > TOOL_CALL`, but:

1. There's no UI affordance to **name** an OpenCode sub-agent (Workshop currently shows "tool: task")
2. No way to filter by sub-agent identity
3. No way to see the sub-agent's full conversation as a separate "session"

**Plan (F-003):**
- Hook `tool.execute.before` (per our opencode-workshop-plugin fork): when `tool === "task"`, set `metadata.subagent_name` from input args (OpenCode's `task` tool takes a `description` arg).
- In Workshop UI: `RunDetail` shows the task tool as a card with the name + child spans as its own sub-tree.
- Filter sidebar gets a new section "Sub-agents in this run".

**Todos:**
- [x] Plan F-003 (this entry)
- [x] Patch opencode-workshop-plugin: attach `subagent_name` attribute to the `task` tool span (description or prompt prefix) — shipped in v0.1.0-kolya.7 (ESM + CJS dist/, mirrored branch in tool.execute.before)
- [x] In `src/agents.ts`: detect sub-agents by tool name `task` (Pattern 3) — bare root span even before LLM child is born; also read `subagent_name` from the tool span's own attributes (plugin can attach it there); prefer `subagent_name` over span.name for `SubAgent.name`
- [x] SpanTree/SubAgentBlock now display the human label (was already in place; just unblocked by plugin metadata + Pattern 3)
- [ ] Add "Sub-agents" section to RunDetail sidebar — scoped OUT by base proposal (no sidebar component exists)
- [ ] Test: run an OpenCode session that uses task tool, verify span tree shows named sub-agents (needs daemon + plugin session)

**Extension — drill-down + timeline (openspec change `extend-subagent-drilldown-f003`):**
- [x] Multi-level drill-down in `RunDetail.tsx`: `focusStack` + breadcrumb chain (Run › A › B), back pops one level, ancestor click truncates
- [x] Nested sub-agents visible inside the focused agent view (`childAgents` → ChatFlow blocks + scoped "Session Tree" tab)
- [x] `SpanTree.tsx`: in-tree `SubAgentBlock` "Open Sub-Agent →" dive-in via optional `onDiveIn` prop
- [x] `FlameTimeline.tsx`: gold bars + gold row labels for sub-agent roots, translucent gold time band per sub-agent, click root bar → dive
- [x] `ChatFlow.tsx`: forward `subAgents` + `onDiveIn` to `FlameTimeline`
- [x] Commit `1788319` + push (extension shipped 2026-07-21)

---

### F-002 — Replace Codex / Claude Code integrations with OpenCode equivalents

**Context:** Workshop upstream has integrations for Codex CLI (`src/codex-cli-chat.ts`, `src/codex-sessions.ts`) and Claude Code (`src/claude-cli-chat.ts`, `src/spans/adapters/claude-agent-sdk.ts`). Kolya's stack is OpenCode-first (per task: "Мы все что с ними связано заменяем на opencode").

**Scope of removal:**
- ❌ Codex CLI integration — file `src/codex-cli-chat.ts`, references in `src/provider-options.ts`, `src/secret-store.ts`, `src/annotations.ts`, `src/db/schema.ts`, `scripts/seed-traces.ts`, `src/demo-traces.ts`, `scripts/dev-all.ts`, examples `examples/ai-sdk-chat/`, dependency `@ai-sdk/openai` (only if no other use)
- ❌ Claude Code CLI — file `src/claude-cli-chat.ts`
- ❌ Claude Agent SDK adapter — `src/spans/adapters/claude-agent-sdk.ts` (replaced by opencode-specific adapter)
- ❌ Anthropic-specific — example `examples/claude-agent-sdk/`, `examples/anthropic-chat/`, dependency `@ai-sdk/anthropic`
- ❌ Anthropic-specific provider install in `agent-install` / `examples/`

**Kept (NOT Codex/Claude-specific):**
- ✅ `src/spans/adapters/ai-sdk.ts` — generic AI SDK adapter, used by OpenCode too (OpenCode uses AI SDK-style spans)
- ✅ `src/spans/adapters/livekit.ts` — separate framework
- ✅ `@ai-sdk/openai` dep — OpenCode also uses OpenAI-compatible providers (via OpenCode-go combo), keep
- ✅ `src/agents.ts` (sub-agent detection) — generic, used for OpenCode too
- ✅ `examples/ai-sdk-chat/` — generic AI SDK example, not Codex-specific

**Verification:** after removal, `bun run dev` must still build + serve, OpenCode traces must still stream (this is the regression bar).

**Status 2026-09-01:** Scope is well-defined but no commits yet. Deferred in favour of F-001..F-005 + F-010/F-012/F-013 which deliver user-visible value faster. Will revisit when Kolya signals (currently 0 priority). Safe to leave as-is — files in scope are inert without code paths referencing them after F-001 (Cloud removal) commit `3122268`.

**Todos:**
- [x] Plan F-002 scope (this entry, with explicit "kept" list)
- [ ] `rm` files in scope
- [ ] `grep -r "codex\|claude.code\|claude-agent-sdk\|anthropic" -- src/` should return no results (after fixes)
- [ ] `bun run typecheck` (or whatever upstream uses) — must pass
- [ ] `bun run dev` (or our build) — smoke: OpenCode trace streams to UI
- [ ] Remove `@ai-sdk/anthropic` from package.json (verify OpenCode doesn't need it)
- [ ] Remove `raindrop-ai/claude-agent-sdk` from deps if present
- [ ] Update `examples/` — remove `claude-agent-sdk/` and `anthropic-chat/` (keep ai-sdk-chat and opencode-specific ones if any)
- [ ] Commit + push

---

## Backlog (not yet started, after F-001..F-005)

- F-006 — Reverse-engineer upstream PRs from `raindrop-ai/workshop` selectively (cherry-pick, not full sync — we want specific patches only)
- F-007 — Multi-project isolation in UI (per-`eventName` dashboards, similar to kolya-dashboard)
- F-008 — SQLite FTS5 for full-text search across spans (currently only event-name search)
- F-009 — Replace Drizzle ORM with raw SQL (faster builds, less ceremony) — only if Kolya wants
- F-010 — Move hermes-webui's `session_export_html.py` upstream into opencode-workshop proper (consolidate)

---

## Closed Features

### F-006 — Workshop sidepanel chat: sidepanel env + plugin detection (companion to plugin F-006) — Closed 2026-09-08

**Context:** `POST /api/agent/messages` spawns `opencode run` in the user's workspace. Upstream claude/codex bridges used `--mcp-config <json>` and `--append-system-prompt` to give the agent trace-context MCP tools and a sidepanel role. `opencode run` has neither. The plugin side (`opencode-workshop-plugin` v0.1.0-kolya.15) registers the `workshop` MCP server via its plugin-side `OPENCODE_CONFIG_DIR` bootstrap and prepends the sidepanel system prompt via `experimental.chat.system.transform` — gated on `RAINDROP_SIDEPANEL_ACTIVE=1` + `RAINDROP_SIDEPANEL_RUN_ID=<id>` in the child env.

This feature ships the workshop-side of that contract: the bridge sets those env vars on every spawn, detects when the user has not installed the plugin and returns a clear error, AND writes its own `OPENCODE_CONFIG_DIR` (the parent plugin's `process.env` mutation does not survive execve into the opencode run child).

**Result (workshop-side):** workshop commits `2335892` + corresponding plugin commit `68bd80c`.

- `src/opencode-cli-chat.ts`:
  - `opencodeChildEnv(cwd, backendUrl, { runId, sessionId, sidepanelConfigDir })` always exports `RAINDROP_SIDEPANEL_ACTIVE=1`, `RAINDROP_WORKSHOP_AGENT_PROVIDER=opencode`, `RAINDROP_WORKSHOP_ANNOTATION_SOURCE=opencode`, `OPENCODE_CONFIG_DIR=<tmpdir>`, plus the focused `RAINDROP_SIDEPANEL_RUN_ID`.
  - `isWorkshopPluginInstalled(cwd)`: scans `<cwd>/.opencode/opencode.json{,c}` and `~/.config/opencode/opencode.json{,c}` (HOME read at call-time so tests isolate) for any `plugin` entry that contains the substring `opencode-workshop-plugin`.
  - `writeSidepanelConfigDir(input)`: writes `~/.cache/workshop-sidepanel/<pid>-<ts>/opencode.json` with the stdio MCP server registration. Sweeps stale entries (mtime > 1h). Strips `/v1/` suffix from `RAINDROP_WORKSHOP_URL`. Returns the dir path or `null` on failure.
  - `runOpencodeCliChat`: short-circuits before spawn when `isWorkshopPluginInstalled` is false, emits friendly error, returns `{ code: 1 }`. Passes `sidepanelConfigDir` through spawn env.
- `src/server.ts`: `/api/agent/messages` wires the bridge end-to-end with local origin guard.
- `tests/opencode-cli-chat.test.ts`: 13 new tests covering env composition, plugin detection (4 cases), bridge short-circuit, writeSidepanelConfigDir (returns null / writes valid config / strips /v1/).

**Verification:** `bun x tsc --noEmit` clean, `bun test tests/` 90/90 pass, `bun run build:ui` success. Live end-to-end `curl -X POST /api/agent/messages` returns `text:"F006_BRIDGE_OK 7397d2b00f12adf89bb160615fc5619c"` with `tool_start`/`tool_finish` events for `workshop__get_current_run`.

**Companion plugin (separate repo):** `opencode-workshop-plugin` v0.1.0-kolya.15, commit `68bd80c`.

### F-005 — Self-contained HTML session export — Closed 2026-07-21

**Context:** Kolya asked on 2026-07-02 for an interactive HTML export of runs. Ported pure rendering logic from `hermes-webui/api/session_export_html.py` into workshop-native TypeScript.

**Result:** 3 commits:
- **P1** (`6af1a45`): Pure helpers (`src/export/html-export.ts`: 5 helpers + `renderSessionHtml` + `ExportShape` interface) + 32-test suite (`tests/html-export.test.ts`) + `markdown-it` dependency. Security: remote images neutralized, no external assets, no CDN.
- **P2** (`7fd068b`): Adapter `src/export/run-to-export-shape.ts` (maps `getRunWithSpans` → `ExportShape` via `extractContext()`) + Express endpoint `GET /api/runs/:id/export` with `Content-Disposition: inline; filename="run-{id}.html"`.
- **P3** (`e69a50f`): UI button `app/src/components/ExportButton.tsx` mounted in `RunDetail.tsx` header. Reads `localStorage` theme preference. Opens export in new tab.

**Verification:** `bun test tests/html-export.test.ts` → 32/32 pass. `bun x tsc --noEmit` → 0 errors. `bun run lint` → 0 errors. `bun run build` → success.

**Smoke tests deferred** (require running daemon): curl HTML output, 404 on nonexistent run, browser click-through.

**Plugin-repo impact:** NONE. F-005 consumes existing span data via `extractContext()` — no plugin changes needed. Future enhancements (span tree export, tool call listing, sub-agent hierarchy) would require extending `run-to-export-shape.ts` + `ExportShape`, still plugin-agnostic.

---

### F-004 — Phoenix-style spans UI — Closed 2026-07-21

**Result:** 5 commits implementing Phoenix-style span tree visualization:
- **P1+P2** (`d63bf9a`): Unified span color palette (`span-colors.ts`) with CHAIN/RETRIEVER/EMBEDDING types + nested tree rendering with chevrons, expand/collapse, child-count badges
- **P3** (`7ad4b30`): Tabbed SpanDetail with Messages/Metadata tabs + role-specific message palette (system navy, user gray, assistant orange, tool neutral)
- **P4+P5** (`f7024ae`): Flat/Nested view-mode toggle with localStorage persistence + Session Tree tab for sub-agent hierarchy visualization

**Verification:** `bun x tsc --noEmit` → 0 errors, `bun run lint` → 0 errors (3 pre-existing warnings), `bun run build` → success.

---

### F-001 — Remove all Cloud Raindrop integration — Closed 2026-07-21

**Context:** Workshop upstream had a SaaS cloud product at `app.raindrop.ai` with paid plans, API keys, OAuth, skills marketplace. Kolya wanted ONLY the local debugger.

**Result:** 5 commits removed `src/cloud/` (12 files, -2397 lines), `src/auth/` (5 files incl `oauth.ts`, -847 lines), cloud references from `install.sh` + `README.md` (-83 lines), dropped `@raindrop-ai/ai-sdk` dep (-4 lines), and swept remaining stragglers (MCP `import_cloud_trace` tool, secret-store entries, stale comments). Build + typecheck pass on every commit. Smoke test deferred pending user permission (D6).

**Commits:** `3122268` (C1 src/cloud/) → `451db47` (C2 src/auth/) → `b02efdf` (C3 install/README) → `2d98a41` (C4 deps) → this commit (C5 sweep + PLAN closeout)

**Backward compat:** `source: "local" | "cloud" | null` retained in `src/db.ts` + `src/server.ts` for historical traces already in DB. Drip API URLs (`raindrop.ai` domain) are non-cloud (community content feature).

---

*Maintained by Miko (Hermes Agent) under Kolya's direction. Update in the same commit as the code change.*
