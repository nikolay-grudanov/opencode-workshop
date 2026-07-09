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

## Active Features

### F-005 — Self-contained HTML session export (re-use existing hermes-webui work)

**Context:** Kolya asked on 2026-07-02 for an interactive HTML export of runs (preferring it over MD from opencode). Miko prototyped `render_session_html(session_dict) -> str` in `/home/gna/hermes-webui/api/session_export_html.py` (297 LOC, with 270-LOC test suite) — produces a single static HTML with embedded dark-theme CSS, no CDN, no external assets, no remote images (security: signed URL leak prevention).

**But:** that's a hermes-webui artifact, not an opencode-workshop one. Kolya now wants this **inside opencode-workshop itself** so the Workshop UI can "Export → static HTML" without server round-trip.

**Plan (F-005):**
- Re-use the rendering logic from `hermes-webui/api/session_export_html.py` (it's pure functions, no hermes-webui deps).
- Adapt inputs to our Workshop DB shape: `runs.metadata + runs.spans` (we already serialize spans with full input/output via `replay.ts`).
- Add a new endpoint `GET /api/runs/:id/export` returning text/html.
- Add UI button "Export HTML" on `RunDetail` page.
- Keep the security model: any `<img src="https://...">` is replaced with placeholder before write.

**Where the prototype already exists (for reference, NOT import):**
`/home/gna/hermes-webui/api/session_export_html.py` — see `_neutralize_remote_images()` (chokepoint that keeps export self-contained).

**Todos:**
- [x] Plan F-005 with location-of-existing-work reference (this entry)
- [ ] Read the hermes-webui prototype to identify the pure rendering surface vs hermes-specific glue
- [ ] Decide on adapter: re-implement (clean, but duplicate logic) vs symlink/copy (faster, but coupling) — depends on hermes-webui API stability
- [ ] Add `GET /api/runs/:id/export` endpoint returning text/html with Content-Disposition: attachment
- [ ] Add "Export HTML" button to RunDetail page (calls endpoint, triggers browser download)
- [ ] Add focused test: run with synthetic spans → HTML contains all span names, model, no remote URLs
- [ ] Commit + push (waiting on Kolya's 'push' command)

---

### F-004 — Phoenix-style spans UI (improved span tree)

**Context:** OpenCode sends spans that follow OTel GenAI conventions (`src/parse.ts: normalizeOtelId`, chat/completion → LLM spans, OTel status codes preserved). Phoenix (Arize Phoenix) is the de-facto OSS UI for OTel GenAI traces — Kolya wants similar capabilities in our Workshop.

**Reference screenshots** (added 2026-07-10, Kolya provided both):
- Workshop today (gap analysis): [`ai-docs/reference/workshop-current-span-tree.jpg`](reference/workshop-current-span-tree.jpg)
- Phoenix target (reference): [`ai-docs/reference/phoenix-reference-trace-details.jpg`](reference/phoenix-reference-trace-details.jpg)

**Visual diff (Workshop vs Phoenix):**

| Aspect | Workshop today | Phoenix | Gap |
|---|---|---|---|
| Span tree rendering | Flat list, no parent-child indent | Hierarchical tree with 7 levels of nesting + expand chevrons | 🔴 F-004.1 — add nested tree |
| Span-type color coding | 2 colors (LLM blue / TOOL orange) | 4 colors (Chain blue / Retriever green / Embedding purple / LLM orange) | 🟡 F-004.2 — extend palette |
| Span duration label | Right-aligned ms/s | Right-aligned ms/s + same in tree | ✅ same |
| Timeline (waterfall) | ✅ Horizontal Gantt-style bars | ❌ no waterfall in Phoenix (tree-only) | 🟢 Workshop is **better** here |
| Span metadata sidebar | Model/2 tools/Duration/Tokens/$cost/User/Convo/Trace | Status/Start/End/Latency/TotalTokens | ✅ Workshop covers more |
| Per-span Input Messages | (in Convo tab, mixed in) | Dedicated **Info tab** with system (navy block) + user (gray block) + Input/Invocation Params sub-tabs | 🟡 F-004.3 — split Input Messages into its own tab with role-coloring |
| Feedback (Hallucination, Q&A Correctness) | ❌ absent | ✅ 2-card row, color-coded | 🟢 **Not for F-004** — Kolya hasn't asked; skip |
| Annotations + Add to Dataset | "Annotate" button only | Annotate + Add to Dataset + Code dropdown | 🟡 F-004.4 — Add to Dataset if Kolya wants eval sets |
| Total Traces count in sidebar | ❌ absent | ✅ "Total Traces: 1,400" + projects dropdown | 🟢 Workshop has different project model (per-`eventName` not per-project) |
| Sidebar project list | Left narrow column | Wider sidebar with checkboxes | ✅ same idea |

**Net assessment:**
- Workshop is **stronger on metadata density** (cost, USER/CONVO/TRACE IDs, tool count) and **already has waterfall timeline** (Phoenix doesn't).
- Phoenix is **stronger on tree hierarchy + per-span role-coded message blocks** (which Workshop should adopt).

**Already in place (no work needed):**
- `src/spans/normalize.ts` — already normalizes arbitrary span format → typed `NormalizedSpan`
- `src/spans/adapters/{livekit,claude-agent-sdk,ai-sdk,types}.ts` — adapters from existing frameworks to our format
- `src/agents.ts` — sub-agent detection (TOOL_CALL > LLM_GENERATION > TOOL_CALL pattern)
- `app/src/components/SpanTree.tsx` — color-coded tree in UI
- HTML export has tokens/duration per turn
- Workshop's waterfall timeline is a real Phoenix-style feature

**Plan (5 sub-features):**
- **F-004.1** Nested tree with indentation + expand/collapse chevrons (Phoenix has 7 levels; Workshop is flat)
- **F-004.2** Extend span-type color palette to 4+ types (LLM, CHAIN, TOOL, RETRIEVER, EMBEDDING)
- **F-004.3** Per-span Info tab with role-coded message blocks (system = navy, user = gray, assistant = orange)
- **F-004.4** View modes toggle (Flat waterfall ↔ Nested tree) — Kolya's request 2026-07-10, two views of the same span data so user chooses what they need for the task:
  - **Flat waterfall** (current): Gantt-style horizontal bars, great for latency visualization and "where was time spent"
  - **Nested tree**: indented hierarchical tree (Phoenix style), great for "what called what" — agent → tool → sub-agent → tool
  - Toggle in `RunDetail` toolbar, default = waterfall (current behaviour preserved), prefer last-used in `localStorage`
  - Both views consume the same `runs.spans` data; only rendering differs
- **F-004.5** Session-wide span tree for sub-agent inspection — Kolya's request 2026-07-10:
  - Currently `SpanTree.tsx` shows one level (root spans only), sub-agent children collapse inline
  - New "Session tree" mode shows **full recursive hierarchy** of the entire session: root agent → sub-agent(s) → sub-sub-agent(s) → tool calls
  - **Problem it solves:** today Kolya can't see how a parent task tool spawns a child agent, that child agent runs its own LLM + tool calls, then reports back. The recursion is invisible — the child appears as a flat row.
  - **Implementation:**
    - Build tree from `parent_span_id` field (already in schema per `src/spans/normalize.ts`)
    - Recursive render: each node shows its name, duration, and child count badge ("+3 spans")
    - Sub-agent nodes show their **internal span count** (e.g. "sub-agent: code-review [4 spans, 2.3s]") to summarize the subtree
    - Click on a sub-agent node → expand inline OR jump into a separate "Sub-agent detail" view that re-uses RunDetail but scoped to that sub-tree
  - **Routing:** `RunDetail` gets a "View: Full tree" tab alongside "Overview/Span Tree/Convo" so the user can switch without losing context
  - **Why this matters:** for multi-agent setups (OpenCode `task` tool spawning `explore`/`build`/`plan`), this is the **only** way to debug "why did my agent take 3 minutes and end up nowhere?" — you need to see the whole recursion to find the dead branch

**Verification:** After implementation:
- Render same 5-span trace from `workshop-current-span-tree.jpg` in **Flat waterfall** mode → matches current state
- Render same trace in **Nested tree** mode → 7-level hierarchy visible (matches `phoenix-reference-trace-details.jpg`)
- For an OpenCode session that uses `task` tool (sub-agent), render **Session tree** → show root agent + sub-agent names + their child tools, all expandable
- Visual diff: Workshop after F-004 should match Phoenix on tree depth and color palette

**Todos:**
- [x] Plan F-004 referencing what already exists
- [x] Add reference screenshots to `ai-docs/reference/` and visual diff table
- [x] Plan F-004.4 view modes toggle (Flat ↔ Nested) — Kolya's 2026-07-10 request
- [x] Plan F-004.5 session-wide tree for sub-agent inspection — Kolya's 2026-07-10 request
- [ ] Audit `src/spans/normalize.ts` to verify it captures `parent_span_id` (depth for nesting) — prerequisite for F-004.1 and F-004.5
- [ ] F-004.1: Update `SpanTree.tsx` to render nested tree with indent + chevron (shared component with F-004.5)
- [ ] F-004.2: Add span-type → color mapping for CHAIN, RETRIEVER, EMBEDDING
- [ ] F-004.3: Split Input Messages from Convo tab → Info tab with system/user/assistant role-coloring
- [ ] F-004.4: Add view mode toggle in `RunDetail` toolbar (Flat waterfall ↔ Nested tree), persist choice in `localStorage`
- [ ] F-004.5: Add "Full session tree" tab in `RunDetail` — recursive render with parent_span_id linkage, sub-agent cards with child span count, click to expand/jump
- [ ] Add "Export as OTel JSON" button → `GET /api/runs/:id/export-otel` (optional, F-004.6 if Kolya wants dataset eval)
- [ ] Commit + push

---

### F-003 — Sub-agent visualization for OpenCode `task` tool

**Context:** Kolya uses OpenCode (not Codex/Claude Code) — sub-agents in OpenCode are spawned via the `task` tool (a TOOL_CALL with toolName="task"). Workshop already has `src/agents.ts` that **detects** sub-agents via the generic pattern `TOOL_CALL > LLM_GENERATION > TOOL_CALL`, but:

1. There's no UI affordance to **name** an OpenCode sub-agent (Workshop currently shows "tool: task")
2. No way to filter by sub-agent identity
3. No way to see the sub-agent's full conversation as a separate "session"

**Plan (F-003):**
- Hook `tool.execute.before` (per our opencode-workshop-plugin fork): when `tool === "task"`, set `metadata.subagent_name` from input args (OpenCode's `task` tool takes a `description` arg).
- In Workshop UI: `RunDetail` shows the task tool as a card with the name + child spans as its own sub-tree.
- Filter sidebar gets a new section "Sub-agents in this run".

**Todos:**
- [x] Plan F-003 (this entry)
- [ ] Patch opencode-workshop-plugin: capture `task` tool description into span metadata (in plugin-side — outside this workshop repo)
- [ ] In `src/agents.ts`: detect sub-agents by tool name `task` (not just by tree pattern) for better naming
- [ ] In `SpanTree.tsx`: render sub-agent spans with their name as the label, not just "tool: task"
- [ ] Add "Sub-agents" section to RunDetail sidebar
- [ ] Test: run an OpenCode session that uses task tool, verify span tree shows named sub-agents

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

### F-001 — Remove all Cloud Raindrop integration

**Context:** Workshop upstream has a SaaS cloud product at `app.raindrop.ai` with paid plans, API keys, OAuth, skills marketplace. Kolya wants ONLY the local debugger (the daemon on `localhost:5899` we already use). Cloud = kill.

**Files in scope (all in `src/cloud/`):**
- `src/cloud/apply.ts` — apply cloud config locally
- `src/cloud/constants.ts` — cloud URLs, plan tiers
- `src/cloud/cloud-mcp-proxy.ts` — proxy for cloud MCP
- `src/cloud/env-file.ts` — write cloud config to .env
- `src/cloud/import-trace.ts` — import traces from cloud
- `src/cloud/offer.ts` — pricing/offer UI
- `src/cloud/query-client.ts` — cloud REST client
- `src/cloud/query-key.ts`
- `src/cloud/setup.ts` — `raindrop cloud setup` entry
- `src/cloud/skills.ts` — cloud marketplace skills
- `src/cloud/transient-keys.ts`
- `src/cloud/uninstall.ts`

**Possibly coupled:**
- `src/auth/{login,write-key,token-store,constants}.ts` — OAuth + write-key storage
- `install.sh` — `raindrop cloud setup` install step
- `bin/` (any cloud CLI subcommands)
- `examples/` (any cloud-deploy demos)

**Verification (regression bar):** local workshop daemon starts, OpenCode trace streams, UI shows run. No 401 from cloud. `raindrop cloud` command shouldn't exist anymore.

**Approach:** **Three-step commit per file** for safety: (1) `rm` file + commit; (2) fix any caller — commit; (3) verify `bun run dev` still works. But because there's a lot of cross-references and the user explicitly wants this done, I'll go **directory-by-directory**:

- Commit 1: `rm -rf src/cloud/` + fix any remaining imports
- Commit 2: `rm` auth files (if verification proves cloud-only)
- Commit 3: clean `install.sh` + `bin/`
- Commit 4: clean `package.json` deps (`@raindrop-ai/claude-agent-sdk` if unused after F-002, `@clack/prompts` if cloud-only, `raindrop-ai` meta-pkg if it's cloud-only)
- Commit 5: `grep -r "raindrop\.ai\|apiKeyHealth\|RAINDROP_CLOUD"` and clean

**Todos:**
- [x] Plan F-001 in 5 commits (this entry)
- [ ] Audit caller chain: every import of `src/cloud/*` and `src/auth/*` to know blast radius
- [ ] Commit 1: `rm -rf src/cloud/` + fix imports
- [ ] Commit 2: `rm src/auth/*` (after verification)
- [ ] Commit 3: clean `install.sh` + `bin/` (remove `cloud` subcommand)
- [ ] Commit 4: clean `package.json` deps
- [ ] Commit 5: final grep cleanup
- [ ] `bun run dev` — local daemon starts, smoke test (OpenCode trace from real opencode-workshop-plugin works)
- [ ] Update `README.md` (remove mentions of `raindrop cloud`, paid plans, OAuth)
- [ ] Commit + push (5 commits)

---

## Backlog (not yet started, after F-001..F-005)

- F-006 — Reverse-engineer upstream PRs from `raindrop-ai/workshop` selectively (cherry-pick, not full sync — we want specific patches only)
- F-007 — Multi-project isolation in UI (per-`eventName` dashboards, similar to kolya-dashboard)
- F-008 — SQLite FTS5 for full-text search across spans (currently only event-name search)
- F-009 — Replace Drizzle ORM with raw SQL (faster builds, less ceremony) — only if Kolya wants
- F-010 — Move hermes-webui's `session_export_html.py` upstream into opencode-workshop proper (consolidate)

---

## Closed Features

_(none yet — F-001 will land here once all todos are checked)_

---

*Maintained by Miko (Hermes Agent) under Kolya's direction. Update in the same commit as the code change.*
