# HANDOFF snapshot — opencode-workshop fork, session 2026-07-21

> **For:** Next-session Miko (after Z.ai quota reset).
> **Read alongside:** [`PLAN.md`](PLAN.md) (live features + todos), [`AGENTS.md`](AGENTS.md) (conventions), root [`../AGENTS.md`](../AGENTS.md) (upstream build guide).
> **Mirror in Hindsight:** `mcp_hindsight_recall(query="handoff opencode-workshop 2026-07-21", budget="mid")` — backup.

## TL;DR

Three OpenSpec changes in flight. **F003** (sub-agent visualization) and **F005** (HTML session export) are **committed**. **F004** (Phoenix-style spans UI) is **paused mid-Wave-2** because Z.ai GLM session-quota hit 100% — agents can't run. The orchestrator's own model is healthy, but `task()` has no `model` param, so we can't route subagents around the wall. Wait for Z.ai reset (~57m per quota widget / ~10:20 UTC per system reminder — discrepancy, take whichever fires first), then re-fire Wave-2 agents.

- **HEAD:** `1201a2a` on `main`
- **Branch:** `main` (no other branches in flight)
- **Last 5 commits** (newest first):
  - `1201a2a` fix: drop unused scope binding in init wizard
  - `e69a50f` feat: add Export as HTML button to RunDetail header  *(F005 P3)*
  - `7fd068b` feat: add GET /api/runs/:id/export endpoint  *(F005 P2)*
  - `6af1a45` feat: add HTML session export pure helpers and test suite  *(F005 P1 — pre-existing playwright devDep rode along in this commit, intentional)*
  - `7f14f7e` feat: visualise sub-agents in Span Tree  *(F003)*

## What's done (committed)

### F003 — Sub-agent visualization (`openspec/changes/add-subagent-visualization-f003/`)
16 files. Canonical `detectSubAgents` consolidated to `src/agents.ts:48` (a 4th copy in `SearchPage.tsx` was in-spec to remove). Re-export shim appended to the **existing** `app/src/api/agents.ts` (agent-registry file — not a new file). `SpanRow` gained `attributes?: string | null`; `SubAgent` gained `subagent_name?: string` (kept in sync in both `src/agents.ts` and `app/src/utils/types.ts`).

UI deltas:
- `app/src/components/SpanTree.tsx` — `SUB_AGENT_ROOT: { color: "#d4a857", label: "AGENT" }` entry in TYPE_LABEL map (~line 49); `inferSpanTypeForDisplay` helper; friendly `Sub-agent: {subagent_name ?? "task N"}` labels; in-tree `SubAgentBlock` header (~line 427).
- `app/src/components/FlameTimeline.tsx` — `#d4a857` tooltip badge (~line 10).
- `app/src/components/SubAgentBlock.tsx` — new shared component, extracted from `ChatFlow.tsx:72`.
- `app/tests-e2e/workshop-actions.spec.ts` — e2e assertions at line 213 (gold badge, friendly label, SubAgentBlock).
- Unused `SubAgent` imports dropped from `app/src/api/query-api.ts` and `app/src/pages/SearchPage.tsx`.
- `RunDetail.tsx` untouched — `SpanTree`/`FlameTimeline` call `detectSubAgents(spans)` internally.

### F005 — HTML session export (`openspec/changes/add-html-session-export-f005/`)
3 commits, one per phase. **`src/server.ts` is Express-style** (not Hono as some task wording assumed).

- **P1** (`6af1a45`): `package.json` +`markdown-it ^14.1.0` + `@types/markdown-it`; `src/export/html-export.ts` (~230 LOC: 5 pure helpers + `renderSessionHtml` + `ExportShape` interface; split light/dark CSS in `:root` / `:root.dark`; pre-neutralize raw `<img>` tags + `flattenLinksInImagePlaceholders` to defeat linkify-inside-placeholder); `tests/html-export.test.ts` (32 tests, all pass).
- **P2** (`7fd068b`): `src/export/run-to-export-shape.ts` (~74 LOC, uses `(span as any).model` cast — pre-existing `getRunWithSpans` type limitation); `src/server.ts` adds `app.get("/api/runs/:id/export")`; `src/replay.ts` exposes `extractContext` (`export` keyword added).
- **P3** (`e69a50f`): `app/src/components/ExportButton.tsx` (~30 LOC, `window.open` against `/api/runs/${runId}/export?theme=`); mounted in `app/src/pages/RunDetail.tsx` header before `MoreMenu`; F005 openspec dir created.

Plus housekeeping:
- `1201a2a` — `src/init.ts` lint fix (`scope` → `_scope`). Had to be a separate commit because the F005-P3 commit was already staged.

### Verification status post-Wave-1
- `bun x tsc --noEmit` (root tsconfig, daemon side) → exit 0
- `bun run lint` → 0 errors, 3 pre-existing react-hooks-deps warnings (MessagePane/RunDetail/use-agents)
- `bun test tests/html-export.test.ts` → 32/32 pass
- `bun run build` → exit 0 (3.03s)

### Tasks.md checkboxes still unchecked (intentional orchestrator skips)
- **F003** (`add-subagent-visualization-f003/tasks.md`): commit task 7.7 flipped pre-commit; **remaining unchecked = daemon smokes only**: 7.6, 3.5, 4.5, 5.4, 6.3.
- **F005** (`add-html-session-export-f005/tasks.md`): commits 1.10/2.9/3.7 flipped pre-commit; **remaining unchecked = daemon smokes only**: 2.7, 2.8, 3.5.

If you run a real daemon later, you can flip those smoke-checkboxes and execute the smoke tests yourself — or leave them as documentation of "smoke-tested-via-curl" status.

## What's in progress

### F004 — Phoenix-style spans UI (`openspec/changes/improve-spans-ui-phoenix-style-f004/`)

**Depends on F003** (the `#d4a857` SUB_AGENT_ROOT color lives in `SpanTree`/`FlameTimeline` type maps; F004-P1 moves it into the new `span-colors.ts` module — preserve, don't delete).

**46 tasks in 5 phases:**
- **P1 (1–10)** Unified span colour palette: new `app/src/utils/span-colors.ts` (`SPAN_TYPE_COLORS` + `spanColor()` with SUB_AGENT_ROOT `#d4a857`); extend `src/parse.ts:35–41` `inferSpanType` and `app/src/utils/types.ts` with `CHAIN`/`RETRIEVER`/`EMBEDDING`; rewire `SpanTree` + `FlameTimeline`; gut rotating palette in `app/src/utils/colors.ts`.
- **P2 (11–20)** Nested SpanTree: recursive `Row` + chevrons `▸`/`▾` + expand/collapse `Map` (seeded `true`, reset on `runId` change) + child-count badges.
- **P3 (21–29)** Tabbed SpanDetail: `Messages`/`Metadata` (Messages only for `LLM_GENERATION`, via `span.normalized.messages` + `MessageList` + `app/src/utils/messageParsing.ts`); role palette — system navy / user cool gray / assistant warm orange / tool neutral.
- **P4 (30–38)** Flat|Nested toggle: `RunDetail.tsx` toggle + localStorage `workshop.spanViewMode` (malformed → `nested`); pass `viewMode` to `SpanTree` (flat=legacy) + `FlameTimeline` (flat=group by name, nested=group by `parent_span_id`).
- **P5 (39–46)** Session tab: `RunView` enum +`"session"`; route `/runs/:runId/session` in `app/src/router.tsx:101–105`; Session tab between Span Tree and Convo in `RunDetail.tsx:1357–1362`; groups by parent/child with sub-agent display names.

**Pre-committed commit messages** (use exactly):
| Phase | Message |
|---|---|
| P1 | `feat: unify span colour palette across SpanTree and FlameTimeline` |
| P2 | `feat: render SpanTree as nested DOM with chevrons and child-count badges` |
| P3 | `feat: tabbed SpanDetail with role-specific message palette` |
| P4 | `feat: Flat/Nested view-mode toggle with localStorage persistence` |
| P5 | `feat: Session tree tab grouping spans by parent/child` *(body: `Refs F-004. Closes F-004. Depends on F-003 canonical SubAgent shape.`)* |

### Why paused
Both initial Wave-2 agents (`bg_3ece0c78` P1+P2, `bg_c5043af9` P3) failed on `zai-coding-plan/glm-5.2` session-quota 100%. Auto-retry then failed on `opencode-go/glm-5.2` (also 100% rate-limited, 4h 08m reset). Two re-fired fresh agents (`bg_9ef3cfc8`, `bg_4c35cb40`) **also failed** on the same chain — their retry sessions (`ses_07da7d449ffeUb9j97Fe60jum0`, `ses_07da7d3bcffeh3UVGu4szrn17I`) are stuck on the doomed OpenCode Go fallback and **must NOT be resumed** when Z.ai resets.

## Resume checklist (next session)

1. **Check Z.ai alive.** Ask user to call `quota` or run it via MCP if available. If session quota shows >0%, proceed. If still 100%, ask user — wait again, or implement F004 directly via orchestrator's own model.

2. **Run Wave 2 in parallel** — two fresh `task()` calls. Do NOT resume the dead `ses_07da7d44*` / `ses_07da7d3b*` sessions. Skip-list for BOTH agents:
   - **Skip (leave unchecked):** commit tasks 10, 20, 29 + daemon smoke tests 9, 18, 19, 28.
   - **No git mutations** (no commit / add / checkout / restore).
   - **No `bun run build`** — orchestrator runs builds at wave boundaries.
   - **No daemon start/restart/kill.**
   - **No `as any` / `@ts-ignore` / `@ts-expect-error`.**

   **Agent A — visual-engineering, P1+P2 (tasks 1–20).**
   Owns: `app/src/utils/span-colors.ts` (new), `src/parse.ts`, `app/src/utils/types.ts`, `app/src/utils/colors.ts`, `app/src/components/SpanTree.tsx`, `app/src/components/FlameTimeline.tsx`.
   Tell it: F003 is committed — SpanTree/FlameTimeline already have the gold `#d4a857` SUB_AGENT_ROOT badge, friendly labels, in-tree SubAgentBlock, and `inferSpanTypeForDisplay`. Preserve all of that. P1 just rewires colors onto the new `span-colors.ts` module while keeping `#d4a857` in `SPAN_TYPE_COLORS.SUB_AGENT_ROOT`. Verify with `bun x tsc --noEmit` + `bun run lint`.

   **Agent B — visual-engineering, P3 (tasks 21–29).**
   Owns: `app/src/components/SpanDetail.tsx`, `app/src/components/MessageList.tsx`, `app/src/utils/messageParsing.ts`.
   Tell it: F003 is committed — `src/agents.ts` is canonical `SubAgent` shape (re-exported via `app/src/api/agents.ts`); you don't need it but don't duplicate. F005 is committed — `src/replay.ts` exports `extractContext`; `attachNormalized` (in `src/db.ts`) populates `span.normalized` including LLM messages. Reuse those. If you need a message type that lives in `app/src/utils/types.ts`, **work around locally** — Agent A owns types.ts in parallel. Verify with `bun x tsc --noEmit` + `bun run lint`.

3. **Post-Wave-2 (orchestrator):** `bun x tsc --noEmit` + `bun run lint` + `bun test` + `bun run build`. Flip commit-task checkboxes pre-commit (10, 20, 29). Commit P1, P2, P3 separately with the exact messages above.

4. **Wave 3 — F004 P4+P5 (tasks 30–46):** re-fire one or two visual-engineering agents in parallel. Skip-list: commits 38, 46 + daemon smokes 37, 44. P5 adds `/runs/:runId/session` route + Session tab in `RunDetail.tsx`. P5 commit body must be `Refs F-004. Closes F-004. Depends on F-003 canonical SubAgent shape.`

5. **Final:** full verification (build + lint + tsc + tests), commit P4 + P5, archive the three OpenSpec changes via `openspec-archive-change`, run `graphify update .`, write final report to `PLAN.md`.

## Known gotchas (do NOT fix in this session, leave for explicit ask)

- **Pre-existing app-side tsc issues:**
  - `lucide-react` and `react-router-dom` have React-19 JSX type incompatibilities.
  - `app/src/pages/SavedPage.tsx:1094` has a missing `Run` import.
  - Root `bun x tsc --noEmit` only checks root `src/` (tsconfig include) — these app issues won't surface from root. Use `cd app && bun x tsc --noEmit` to see them.
- **`src/server.ts` is Express-style** (`app.get("/api/runs/:id/export")`), not Hono. Some OpenSpec task wording assumed Hono.
- **Pre-existing dirty state (NOT yours, never stage/revert):**
  - `M bun.lock + package.json` (playwright 1.60.0 devDep from prior e2e work — landed in F005-P1 commit because Bun bundled them together)
  - `M oh-my-openagent.json`
  - `D f001/f002` change files
  - untracked `.opencode/oh-my-openagent.json`, `openspec/changes/{f003,f004,f005,archive}`, `openspec/specs`
- **`src/agents.ts` is the canonical SubAgent shape**; `app/src/utils/types.ts` mirrors it. When extending, keep both in sync.

## Todos snapshot (from orchestrator)

| Status | Content |
|---|---|
| completed | Wave-1a: Delegate F003 to visual-engineering |
| completed | Wave-1b: Delegate F005 to unspecified-high |
| completed | Post-Wave-1: Verify + commit F003+F005, compress |
| **in_progress** | Wave-2a: Delegate F004 P1+P2 (after F003) |
| **in_progress** | Wave-2b: Delegate F004 P3 |
| pending | Post-Wave-2: Verify + commit F004 P1–P3 |
| pending | Wave-3: Delegate F004 P4+P5 |
| pending | Final: full verify, commit P4–P5, archive, graphify, final report |

## Reference files (read in this order if fresh)

1. Root `AGENTS.md` — upstream build/dev guide, user-vs-developer fork.
2. `ai-docs/AGENTS.md` — Kolya's fork conventions, Miko rules.
3. `ai-docs/PLAN.md` — live plan + todos (single source of truth per AGENTS.md).
4. This file — what's done, what's blocked.
5. `openspec/changes/improve-spans-ui-phoenix-style-f004/{proposal.md, design.md, tasks.md, specs/}` — canonical F004 spec.
6. `openspec/changes/add-subagent-visualization-f003/tasks.md` — F003 (mostly done).
7. `openspec/changes/add-html-session-export-f005/tasks.md` — F005 (mostly done).
8. `graphify-out/GRAPH_REPORT.md` — codebase knowledge graph (run `graphify update .` after code changes).
9. `ai-docs/ARCHITECTURE.md` — system architecture.
10. `ai-docs/DEVELOPMENT.md` — dev env, scripts, lint/typecheck commands.

---

*Maintained by Miko (Sisyphus / MiniMax-M3 orchestrator). Updated 2026-07-21 04:25 MSK.*
*Original handoff: 2026-07-10 00:30 MSK (kickoff snapshot, replaced).*