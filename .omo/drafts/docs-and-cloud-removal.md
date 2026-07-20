---
slug: docs-and-cloud-removal
status: approved
intent: unclear
approved_at: 2026-07-20
approved_by: user (explicit high-accuracy review request, m0019, interpreted as approval+review)
review_required: true
plan_path: .omo/plans/docs-and-cloud-removal.md
plan_sha256: null
review_round_id: null
pending-action: write and review .omo/plans/docs-and-cloud-removal.md
review:
  momus:
    status: pending
    workspace_root: null
    runtime_home: null
    target: .omo/plans/docs-and-cloud-removal.md
    round_id: null
    plan_sha256: null
    launch_id: null
    session: null
    result: null
  independent:
    status: pending
    workspace_root: null
    runtime_home: null
    target: .omo/plans/docs-and-cloud-removal.md
    round_id: null
    plan_sha256: null
    launch_id: null
    session: null
    result: null
approach: "Two-phase plan. Phase A restores 5 missing technical reference docs in ai-docs/ (the fork's doc space; docs/ stays upstream-owned). Phase B executes F-001 (remove all Cloud Raindrop integration) as 5 worker-ready commits with exact file lists, caller fixes, per-commit verification, and the regression bar (local daemon starts, OpenCode trace streams, no cloud refs). After approval: scaffold plan, run Metis, then mandatory dual high-accuracy review (momus + oracle)."
---

# Draft: docs-and-cloud-removal

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

- **C1 — ARCHITECTURE.md** | Module map of `src/` (daemon entry → server → db → spans → agents → UI), data flow (OTLP ingest → normalize → SQLite → WS stream → React UI), and the upstream-vs-fork split. | active | `src/index.ts:1-80`, `src/server.ts:1-100`, `ai-docs/AGENTS.md:10-23`, `package.json:17-41`
- **C2 — API.md** | Exhaustive HTTP+WS surface: every `/api/*` route and WS event the daemon exposes (runs, spans, annotations, saved events, replay, live events), with request/response shapes. | active | `src/server.ts` (2550 LOC, route definitions), `README.md:113-134`
- **C3 — PLUGIN-CONTRACT.md** | The contract the companion plugin (`@grudanov-nikolay/opencode-workshop-plugin`) must satisfy: OTLP ingest endpoint, span shape, `task` sub-agent metadata, env vars (`RAINDROP_LOCAL_DEBUGGER`). | active | `src/parse.ts`, `src/otlp-protobuf.ts`, `src/spans/normalize.ts`, `ai-docs/HANDOFF.md:55-63`
- **C4 — DATABASE.md** | SQLite schema (Drizzle), tables (`runs`, `spans`, `annotations`, `saved_events`, `saved_folders`, `live_events`), migration workflow (`db:generate`/`db:embed`/`db:migrate`), DB path env var. | active | `src/db/schema.ts`, `src/db/migration-assets.ts`, `drizzle.config.ts`, `package.json:28-31`
- **C5 — DEVELOPMENT.md** | Dev environment deeper than upstream AGENTS.md: env vars (port, bind host, DB path, UI port), `dev` vs `dev:server` vs `dev:ui`, smoke-test procedure, build matrix, lint/test commands, the no-tests/-dir gap. | active | `package.json:17-41`, `ai-docs/AGENTS.md:61-75`, `README.md:113-120`
- **C6 — F-001 commit 1** | `rm -rf src/cloud/` (12 files) + fix every importer in `src/server.ts` and elsewhere. | active | `src/cloud/` (12 files), `src/server.ts:27-54,50-54`, `ai-docs/PLAN.md:183-211`
- **C7 — F-001 commit 2** | Remove `src/auth/` (5 files) + remove `cmdLogin`/`cmdLogout` wiring in `src/index.ts` + drop `raindrop login`/`raindrop logout` CLI commands. | active | `src/auth/` (5 files), `src/index.ts:46`, `ai-docs/PLAN.md:198,217`
- **C8 — F-001 commit 3** | Clean `install.sh` and `bin/raindrop-dev` of `raindrop cloud setup`, `--cloud` flag, OAuth steps; README cleanup of cloud sections. | active | `install.sh`, `bin/raindrop-dev`, `README.md:49-103`, `ai-docs/PLAN.md:199,210,218,222`
- **C9 — F-001 commit 4** | `package.json` deps cleanup: drop `@clack/prompts` (if cloud-only after audit), keep `raindrop-ai` (daemon parts), keep `@ai-sdk/openai` (OpenCode uses OpenAI-compatible providers). | active | `package.json:42-61`, `ai-docs/PLAN.md:210,219`
- **C10 — F-001 commit 5** | Final grep sweep `grep -rn "raindrop\.ai\|apiKeyHealth\|RAINDROP_CLOUD\|app\.raindrop\|cloud setup\|cloudMcp\|writeKey\|write_key"` across repo; clean residuals; flip PLAN.md checkboxes; move F-001 to Closed Features. | active | `ai-docs/PLAN.md:211,220,223,237-239`

## Open assumptions (announced defaults)
<!-- Intent is UNCLEAR: research resolves ambiguity, defaults are adopted (not asked), and each is surfaced in the plan's human TL;DR for veto. -->
<!-- assumption | adopted default | rationale | reversible? -->

- **Where restored docs live** | `ai-docs/` (NOT `docs/`) | Fork convention: `ai-docs/AGENTS.md:55-59` explicitly marks `docs/` as upstream-owned ("only update if explicitly told to"); all fork docs already live in `ai-docs/`. | YES — moving files is trivial.
- **Which docs are "missing for full development"** | The 5 standard technical reference docs absent today: `ARCHITECTURE.md`, `API.md`, `PLUGIN-CONTRACT.md`, `DATABASE.md`, `DEVELOPMENT.md` | These are the doc types a TypeScript daemon+UI project of this complexity needs for onboarding/development, and none exist (only process docs PLAN/HANDOFF/AGENTS do). Standard industry set. | YES — user can veto any single doc at the gate and I drop it from Scope.
- **Depth of F-001 plan** | Worker-ready expansion of the existing `ai-docs/PLAN.md` F-001 entry, NOT a replacement of that entry | PLAN.md is declared "single source of truth" (`ai-docs/PLAN.md:3-4`); the ulw-plan is the executable expansion. PLAN.md's checkboxes flip per commit; PLAN.md's prose stays. | YES.
- **Commit count for F-001** | Exactly 5 commits matching Kolya's "5-7 commits for F-001" preference | `ai-docs/HANDOFF.md:61` and `ai-docs/PLAN.md:205-211,214,223` both lock this in. Worker must not squash into 1 mega-commit. | NO — owner preference (Kolya's explicit style); reversible only by rebase.
- **`raindrop-ai` meta-package stays** | Keep `raindrop-ai@^0.0.89` in deps | `ai-docs/HANDOFF.md:40` says "keep for daemon parts" — it provides the local daemon primitives, NOT just cloud. Removing it would break the daemon. | NO — load-bearing for daemon; removal is F-009-class scope (out of F-001).
- **`@ai-sdk/openai` stays** | Keep `@ai-sdk/openai@^3.0.26` | `ai-docs/PLAN.md:160` (F-002 "Kept" list) and `ai-docs/HANDOFF.md:40`: OpenCode uses OpenAI-compatible providers. | NO — load-bearing for OpenCode provider support.
- **`@ai-sdk/anthropic` and `@raindrop-ai/claude-agent-sdk` removal** | OUT of F-001 scope; belongs to F-002 | `ai-docs/PLAN.md:151-156,166-176` assigns these to F-002. F-001 is cloud-only. | YES — but mixing F-001/F-002 violates Kolya's "one Feature per commit" rule.
- **No auto-push** | Worker commits locally only; never `git push` without Kolya's explicit "push" | `ai-docs/HANDOFF.md:59`, `ai-docs/AGENTS.md:79`: locked-in Miko rule. | NO — owner-decision, safety.
- **Docs phase BEFORE F-001 phase** | Sequential: docs first, then F-001 | Docs are referenced by F-001's verification (API.md documents the endpoints whose cloud routes get removed); having docs first makes the F-001 blast-radius audit self-checking. | YES — worker can reorder if Kolya prefers.
- **No tests/ creation in this plan** | Note the missing `tests/` dir as a known gap in DEVELOPMENT.md but DO NOT create tests | `package.json:35` references `bun test tests/` but `tests/` does not exist; "restore missing documentation" is doc-scope, not test-infrastructure-scope. Creating tests is unrequested scope creep. | YES.
- **High-accuracy review is mandatory** | Dual review (momus + oracle) runs after approval, before delivery | UNCLEAR non-Trivial routing per `references/intent-unclear.md:28-32` and `references/full-workflow.md:169`. | NO — process gate.

## Findings (cited - path:lines)

- **Project identity**: Kolya's fork of `raindrop-ai/workshop`, local-only debugger. `ai-docs/AGENTS.md:10-23`; public repo `https://github.com/nikolay-grudanov/opencode-workshop`. `ai-docs/HANDOFF.md:9-15`.
- **F-001 already scoped at high level**: 5-commit plan, file lists, verification bar. `ai-docs/PLAN.md:179-223`.
- **Cloud surface — 12 files in `src/cloud/`**: `apply.ts`, `cloud-mcp-proxy.ts`, `constants.ts`, `env-file.ts`, `import-trace.ts`, `offer.ts`, `query-client.ts`, `query-key.ts`, `setup.ts`, `skills.ts`, `transient-keys.ts`, `uninstall.ts`. `src/cloud/` (directory listing), `ai-docs/PLAN.md:183-194`.
- **Auth surface — 5 files in `src/auth/`**: `constants.ts`, `login.ts`, `oauth.ts`, `token-store.ts`, `write-key.ts`. `src/auth/` (directory listing). NOTE: PLAN.md line 198 lists only 4 (`{login,write-key,token-store,constants}`); `oauth.ts` also exists and must be removed.
- **server.ts cloud wiring** (callers to fix at commit 1): imports `importCloudTrace, ImportCloudTraceRefused` (`./cloud/import-trace`), `QueryApiError, queryApiGet` (`./cloud/query-client`), `normalizeQueryApiKey` (`./cloud/query-key`), `TransientQueryApiKeyStore` (`./cloud/transient-keys`), `CLOUD_MCP_PROXY_PATH, bearerTokenFromHeader, createCloudMcpProxy` (`./cloud/cloud-mcp-proxy`). `src/server.ts:50-54`. Also `cloudMcpUrl, hasCloudMcpConfigured` from `./agent-chat`. `src/server.ts:27-34`.
- **index.ts auth wiring** (callers to fix at commit 2): `import { cmdLogin, cmdLogout } from "./auth/login";` `src/index.ts:46`. CLI help strings reference `raindrop login`/`raindrop logout`. `src/index.ts:9-28` (no cloud/login in help block — already minimal; verify with grep).
- **package.json deps under audit**: `@clack/prompts@^1.3.0` (cloud-offer UI — candidate for removal), `raindrop-ai@^0.0.89` (KEEP — daemon), `@ai-sdk/anthropic@^3.0.69` (F-002, NOT F-001), `@raindrop-ai/claude-agent-sdk@^0.0.10` (F-002, NOT F-001), `@ai-sdk/openai@^3.0.26` (KEEP). `package.json:42-61`, `ai-docs/HANDOFF.md:40`.
- **No `tests/` directory exists** despite `package.json:35` `"test": "bun test tests/"`. Verified by direct `read` of `/home/gna/.../tests` → "File not found".
- **Existing docs inventory**: repo-root `README.md` (154 LOC, upstream), `AGENTS.md` (upstream, do-not-touch), `LICENSE`. `ai-docs/`: `AGENTS.md` (99 LOC, fork conventions), `HANDOFF.md` (92 LOC, 2026-07-10 snapshot), `PLAN.md` (243 LOC, F-001..F-005 + backlog), `reference/` (2 jpg screenshots for F-004). `docs/`: only `assets/`. **No ARCHITECTURE / API / PLUGIN-CONTRACT / DATABASE / DEVELOPMENT / CONTRIBUTING exists.**
- **README cloud sections to clean** (commit 3): "Raindrop Cloud" prose block `README.md:49-103` (cloud setup, OAuth, `raindrop cloud setup`, `--cloud` one-liner, `raindrop cloud uninstall`); CLI block `README.md:130-134` (`raindrop login`, `raindrop logout`, `raindrop cloud setup`, `raindrop cloud uninstall`).
- **Worktree state**: `.omo/` has only `run-continuation/` (no existing plans/drafts). `.opencode/` has `opencode.json` + `commands/` + `skills/`. No uncommitted changes observed in surveyed paths.
- **Smoke-test procedure exists**: `ai-docs/AGENTS.md:70-75` (start daemon → run OpenCode with plugin → `curl http://localhost:5899/api/runs?limit=1` → verify span tree). This is the F-001 regression bar.

## Decisions (with rationale)

1. **One plan, two phases (A: docs, B: F-001)** rather than two plans — ulw-plan rule "ONE request -> ONE plan, however large" (`references/full-workflow.md:13,140`). Phases are independent but bundled by the user's numbered request.
2. **Docs target `ai-docs/`** not `docs/` — fork convention (`ai-docs/AGENTS.md:55-59`).
3. **5 docs, no more** — standard technical-reference set; PROCESS docs (PLAN/HANDOFF/AGENTS) already exist and are not re-created; CONTRIBUTING is out of scope (fork uses AGENTS.md for that).
4. **F-001 = 5 commits exactly** matching PLAN.md and Kolya's style preference; each commit independently verifiable.
5. **oauth.ts added to removal list** — PLAN.md missed it (lists 4 auth files, actually 5).
6. **F-002 deps (`@ai-sdk/anthropic`, `@raindrop-ai/claude-agent-sdk`) explicitly OUT of F-001** — keeps Features atomic per Kolya's rule.
7. **`tests/` creation deferred** — doc-scope request only; gap is documented in DEVELOPMENT.md for a future feature.
8. **High-accuracy dual review runs automatically** — UNCLEAR non-Trivial; substitutes for the skipped interview (`references/intent-unclear.md:28-32`).

## Scope IN

**Phase A — Documentation restoration (5 files in `ai-docs/`):**
- `ai-docs/ARCHITECTURE.md` — module map, data flow, upstream-vs-fork boundary.
- `ai-docs/API.md` — every HTTP route + WS event the daemon exposes.
- `ai-docs/PLUGIN-CONTRACT.md` — what `opencode-workshop-plugin` must send (OTLP endpoint, span shape, env).
- `ai-docs/DATABASE.md` — Drizzle schema tables + migration workflow.
- `ai-docs/DEVELOPMENT.md` — env vars, dev commands, smoke test, the tests/-gap note.
- Update `ai-docs/AGENTS.md` "Quick reference" table to link the 5 new docs.

**Phase B — F-001 Cloud removal (5 commits):**
- C1: `rm -rf src/cloud/` + fix `src/server.ts` and all other importers.
- C2: `rm -rf src/auth/` (5 files incl. `oauth.ts`) + remove `cmdLogin`/`cmdLogout` from `src/index.ts` + drop `raindrop login`/`logout` CLI commands.
- C3: Clean `install.sh`, `bin/raindrop-dev`, `README.md` (remove "Raindrop Cloud" section lines 49-103 + cloud CLI entries 130-134).
- C4: `package.json` deps audit — drop `@clack/prompts` IF audit confirms cloud-only; keep `raindrop-ai`, `@ai-sdk/openai`.
- C5: Final grep sweep + flip PLAN.md checkboxes + move F-001 to "## Closed Features".

## Scope OUT (Must NOT have)

- ❌ `docs/` directory edits (upstream-owned; `ai-docs/AGENTS.md:55-59`).
- ❌ Repo-root `AGENTS.md` edits (upstream-owned; `ai-docs/AGENTS.md:55-59`).
- ❌ `LICENSE`, `bun.lock` edits (upstream-owned).
- ❌ F-002 work (Codex/Claude/Anthropic removal) — separate feature, `ai-docs/PLAN.md:146-176`.
- ❌ F-003/F-004/F-005 work — separate features.
- ❌ Removing `raindrop-ai` meta-package (load-bearing for daemon; F-009-class).
- ❌ Removing `@ai-sdk/openai` (load-bearing for OpenCode provider support).
- ❌ Removing `@ai-sdk/anthropic` or `@raindrop-ai/claude-agent-sdk` (F-002 scope).
- ❌ Creating `tests/` directory or writing tests (out of "restore documentation" scope).
- ❌ `git push` without Kolya's explicit "push" (`ai-docs/HANDOFF.md:59`).
- ❌ Restarting the daemon or OpenCode without explicit OK (`ai-docs/HANDOFF.md:67`).
- ❌ Adding any new cloud/OAuth/write-key/app.raindrop.ai code (`ai-docs/AGENTS.md:42`).
- ❌ Adding Codex/Claude/Anthropic code (`ai-docs/AGENTS.md:43`).
- ❌ Squashing F-001 into fewer than 5 commits (Kolya's style preference).

## Open questions

None. UNCLEAR routing — all forks resolved by research + adopted defaults above. User vetoes any default at the approval gate.

## Approval gate
status: approved

**Approach**: Two-phase plan. Phase A creates 5 technical reference docs in `ai-docs/` (ARCHITECTURE, API, PLUGIN-CONTRACT, DATABASE, DEVELOPMENT). Phase B executes F-001 in exactly 5 commits (rm cloud → rm auth → clean install/README → deps audit → grep sweep + PLAN.md closeout), each with per-commit verification and the daemon-starts + trace-streams regression bar.

**Approval recorded**: user explicitly requested high-accuracy review (m0019: "Нужен high-accuracy review. Запусти эти проверки через агентов @Metis @Momus @oracle") — interpreted as approval of the approach + explicit review request.

**Next workflow action** (per `pending_action_policy.review_required`): scaffold `.omo/plans/docs-and-cloud-removal.md` → fill plan completely → run Metis gap analysis (fold findings) → run dual high-accuracy review (momus + independent oracle) against complete plan file → fix/resubmit until both APPROVE → final live validation → summary.

<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
