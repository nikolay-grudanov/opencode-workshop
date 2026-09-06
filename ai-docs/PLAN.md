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
- [ ] F-008-P5 polish / advanced filters (deferred to F-014)

---

## Active Features

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
