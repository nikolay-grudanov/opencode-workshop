## Context

This is `ai-docs/PLAN.md:179-223` F-001: "Remove all Cloud Raindrop integration." The fork's reason for existing (`ai-docs/HANDOFF.md:18-19`) is **local-only debugging**, but the codebase still carries 12 cloud files in `src/cloud/`, 5 auth files in `src/auth/`, cloud wiring in `src/server.ts:50-54,693`, CLI commands `raindrop login`/`logout`/`cloud setup`/`cloud uninstall` in `src/index.ts:46,824,827`, an installer that prompts for cloud (`install.sh:316,327,342-344,729`), and a README with a 55-line "Raindrop Cloud" section (`README.md:49-103`).

Verified current state (reconnaissance at change-creation time):
- **`src/cloud/` — 12 files**: apply, cloud-mcp-proxy, constants, env-file, import-trace, offer, query-client, query-key, setup, skills, transient-keys, uninstall.
- **`src/auth/` — 5 files**: constants, login, oauth, token-store, write-key. NOTE: `ai-docs/PLAN.md:198` listed only 4 (`{login,write-key,token-store,constants}`); `oauth.ts` also exists and MUST be removed.
- **`src/server.ts` cloud imports** (verified by grep):
  - L27: `cloudMcpUrl` from `./agent-chat`
  - L50: `importCloudTrace, ImportCloudTraceRefused` from `./cloud/import-trace`
  - L51: `QueryApiError, queryApiGet` from `./cloud/query-client`
  - L52: `normalizeQueryApiKey` from `./cloud/query-key`
  - L53: `TransientQueryApiKeyStore` from `./cloud/transient-keys`
  - L54: `CLOUD_MCP_PROXY_PATH, bearerTokenFromHeader, createCloudMcpProxy` from `./cloud/cloud-mcp-proxy`
  - L693: `upstreamUrl: () => cloudMcpUrl()` (usage site)
- **`src/agent-chat.ts:150`**: defines `cloudMcpUrl()`; L158 has comment about Raindrop Query API key. Only consumer is `src/server.ts`. MUST also be removed.
- **`src/index.ts`**: L46 imports `cmdLogin, cmdLogout`; L824 invokes `cmdLogin`; L827 invokes `cmdLogout`. CLI help text references cloud commands.
- **`install.sh`**: cloud refs at lines 281-282 (help text), 316 (`--cloud` flag), 319 (Usage), 327 (env var), 342-344 (description), 726, 729 (`setup_cmd=(cloud setup)` branch).
- **`README.md`**: "Raindrop Cloud" section L49-103; CLI commands L130-133.
- **`package.json` deps under audit**: `@clack/prompts@^1.3.0` L45, `@raindrop-ai/ai-sdk@^0.0.24` L47 (audit candidates). `raindrop-ai@^0.0.89` L56 (KEEP — daemon), `@ai-sdk/openai@^3.0.26` L44 (KEEP — OpenCode), `@ai-sdk/anthropic@^3.0.69` L43 + `@raindrop-ai/claude-agent-sdk@^0.0.10` L48 (F-002, OUT).

The previous planning attempt (`.omo/drafts/docs-and-cloud-removal.md`) used a different planning system requiring Metis + Momus + Oracle dual review, which stalled at the `pending-action` field. This OpenSpec change is the re-formulation: F-001 only, no docs (separate change), no review-loop ceremony.

## Goals / Non-Goals

**Goals:**
- Remove the entire cloud SaaS surface from the fork in **exactly 5 commits** (matching `ai-docs/HANDOFF.md:61` and `ai-docs/PLAN.md:205-211,223`).
- Each commit is independently buildable (`bun run build` passes at every intermediate commit).
- Final grep sweep confirms zero cloud references in source.
- Smoke test (with user permission) confirms local daemon + OpenCode trace streaming still works.
- PLAN.md is closed out for F-001.

**Non-Goals:**
- ❌ F-002 (Codex/Claude/Anthropic) — separate change.
- ❌ F-003/F-004/F-005 — separate changes.
- ❌ Removing `raindrop-ai` meta-package (load-bearing).
- ❌ Removing `@ai-sdk/openai` (load-bearing).
- ❌ Touching the OTLP ingest endpoint or the local daemon's API surface — local stack contract is unchanged.
- ❌ Writing new tests (no `tests/` dir; out of scope).
- ❌ Touching upstream-owned files (`docs/`, root `AGENTS.md`, `LICENSE`).
- ❌ Pushing to remote — `git push` requires explicit user "push" (`ai-docs/HANDOFF.md:59`).
- ❌ Restarting daemon/OpenCode without explicit OK (`ai-docs/HANDOFF.md:67`). Smoke test in commit 5 requires user permission.

## Decisions

### D1 — Five-commit decomposition: cloud → auth → install/README → deps → sweep  *(load-bearing)*

**Decision:** F-001 ships as exactly five commits, in this order:

| # | Commit | Files | Verification |
|---|---|---|---|
| 1 | `refactor: remove src/cloud/ SaaS surface` | `src/cloud/*` (12 files deleted), `src/server.ts` (imports L27,L50-54 + usage L693 stripped), `src/agent-chat.ts` (`cloudMcpUrl` L150 stripped) | `bun run build` passes; grep `./cloud/` imports returns 0 |
| 2 | `refactor: remove src/auth/ OAuth + write-key surface` | `src/auth/*` (5 files deleted), `src/index.ts` (imports L46 + branches L824,L827 stripped + help text cleaned) | `bun run build` passes; `raindrop login` is unknown command |
| 3 | `chore: strip cloud references from installer and README` | `install.sh` (--cloud flag, RAINDROP_CLOUD env, cloud-setup branch, help text), `README.md` (L49-103 section, L130-133 CLI entries), `bin/raindrop-dev` (audit + clean if needed) | `bash install.sh --help` shows no cloud; README grep clean |
| 4 | `chore(deps): drop cloud-only packages from package.json` | `package.json` (conditional: `@clack/prompts`, `@raindrop-ai/ai-sdk` IF audit confirms cloud-only), `bun.lock` (auto-updated by `bun install`) | `bun install` succeeds; `bun run build` passes |
| 5 | `chore: final grep sweep + close F-001 in PLAN.md` | Residual files found by grep sweep; `ai-docs/PLAN.md` (flip checkboxes, move to Closed Features) | Grep sweep clean; smoke test passes with user permission |

**Rationale:**
- Order goes from **most code** (cloud) to **least code** (sweep + PLAN.md), so each commit's blast radius is smaller than the previous.
- Putting cloud BEFORE auth is intentional: `src/auth/login.ts` does not import from `src/cloud/`, but `src/cloud/*` files import auth primitives transitively. Removing cloud first isolates auth removal in commit 2.
- Putting deps LAST (commit 4) means we know exactly which deps are unused AFTER all source code that referenced them is gone — no premature dep removal that breaks intermediate commits.
- PLAN.md closeout is in commit 5 (not 4) because the checkboxes can only be flipped after ALL work including the grep sweep is done.

**Alternatives considered:**
- _Single mega-commit `rm -rf src/cloud/ src/auth/ && ...`_ — rejected: violates `ai-docs/HANDOFF.md:61` ("5-7 commits for F-001") and makes review impossible.
- _Commit per file (17+ commits)_ — rejected: violates "one Feature = one commit" rule at the other extreme (Kolya wants commits to be logical units, not file-by-file).
- _Reverse order (deps first)_ — rejected: removing `@clack/prompts` before removing its consumers breaks the build mid-change.

**Reversibility:** Each commit is revertable independently (in reverse order: revert 5 → 4 → 3 → 2 → 1). The whole Feature is revertable via `git revert <commit1>^..<commit5>`.

### D2 — `src/agent-chat.ts` `cloudMcpUrl()` is removed in commit 1, not commit 2  *(load-bearing)*

**Decision:** The `cloudMcpUrl()` function defined at `src/agent-chat.ts:150` is removed in commit 1 (alongside `src/cloud/` removal), because its only consumer is `src/server.ts:27,693`.

**Rationale:** If we remove `src/cloud/` but leave `cloudMcpUrl()` defined, the function becomes dead code that fails the grep sweep. If we remove `cloudMcpUrl()` but leave `src/cloud/`, the daemon loses a function it might still be using transitively. Removing both atomically in commit 1 keeps the build green.

**Alternatives considered:**
- _Treat `src/agent-chat.ts` as part of commit 2 (auth)_ — rejected: `agent-chat.ts` has nothing to do with auth; it's the cloud MCP URL provider.

**Reversibility:** Reverted as part of commit 1 revert.

### D3 — `oauth.ts` is added to commit 2 removal list (PLAN.md missed it)  *(load-bearing)*

**Decision:** Commit 2 removes **5** files from `src/auth/`: `constants.ts`, `login.ts`, `oauth.ts`, `token-store.ts`, `write-key.ts`. This corrects `ai-docs/PLAN.md:198` which lists only 4 files (`{login,write-key,token-store,constants}`).

**Rationale:** `oauth.ts` (12314 bytes) exists in `src/auth/` and is part of the OAuth flow that F-001 removes. PLAN.md's omission is a documentation error, not a decision to keep OAuth.

**Alternatives considered:**
- _Follow PLAN.md literally and skip `oauth.ts`_ — rejected: leaves an orphan OAuth file that fails the grep sweep in commit 5; requires another commit to clean up later.

**Reversibility:** Reverted as part of commit 2 revert.

### D4 — Deps audit is conditional, not automatic  *(reversible)*

**Decision:** Commit 4 removes `@clack/prompts` and/or `@raindrop-ai/ai-sdk` from `package.json` **IF AND ONLY IF** a grep audit confirms they are imported only by code that commits 1-3 deleted. The worker MUST run `grep -rn "@clack/prompts\\|@raindrop-ai/ai-sdk" src/ app/ scripts/ bin/` and document the result in the commit message. If the audit finds any remaining importer outside the deleted scope, the dep is KEPT and the commit message notes the reason.

**Rationale:** Blindly removing deps risks breaking the daemon if a kept module (e.g. something in `src/server.ts` we didn't touch) imports them transitively. Conditional removal with documented audit is the safe path.

**Alternatives considered:**
- _Always remove both_ — rejected: `@raindrop-ai/ai-sdk` might be used by non-cloud AI-SDK code paths; risk too high without audit.
- _Never remove (skip commit 4)_ — rejected: leaves unused deps that bloat the daemon and confuse future contributors.

**Reversibility:** Trivially reversible (re-add to package.json + `bun install`).

### D5 — `raindrop-ai` and `@ai-sdk/openai` are NEVER in scope  *(load-bearing)*

**Decision:** Commits 1-5 MUST NOT remove `raindrop-ai@^0.0.89` (L56) or `@ai-sdk/openai@^3.0.26` (L44) from `package.json`.

**Rationale:**
- `raindrop-ai` provides the daemon primitives (per `ai-docs/HANDOFF.md:40` "keep for daemon parts"). Removing it is F-009-class scope.
- `@ai-sdk/openai` is needed for OpenCode's OpenAI-compatible provider usage (per `ai-docs/PLAN.md:160` F-002 "Kept" list).

**Alternatives considered:**
- _Audit `raindrop-ai` for cloud-only symbols and partial-remove_ — rejected: out of F-001 scope; would require per-symbol analysis that belongs in F-009.

**Reversibility:** N/A — non-removal is the decision.

### D6 — Smoke test in commit 5 requires explicit user permission  *(load-bearing)*

**Decision:** The commit-5 task "start daemon + run OpenCode + verify span streams" requires the user to explicitly say "ok to start daemon" before the worker runs `bun run dev`. The worker MUST NOT start the daemon or OpenCode without that permission, per `ai-docs/HANDOFF.md:67`.

**Rationale:** Miko's locked-in rule (`ai-docs/HANDOFF.md:65-70`): "NO SELF-RESTART — even if the daemon looks broken, ask Kolya before restarting." Smoke test is not exempt.

**Alternatives considered:**
- _Worker starts daemon automatically for verification_ — rejected: violates the locked-in rule.
- _Skip smoke test, trust grep + build_ — rejected: grep and build don't prove the local stack actually works end-to-end.

**Reversibility:** N/A — process rule, not code state.

### D7 — `bun.lock` touch in commit 4 is allowed despite upstream-owned rule  *(load-bearing)*

**Decision:** If commit 4 removes deps, `bun.lock` MUST be updated by `bun install` and committed alongside `package.json`. The `ai-docs/AGENTS.md:59` rule "do not edit `bun.lock` (upstream-owned)" is interpreted as "do not hand-edit or rebase-edit bun.lock"; auto-updating it as a downstream effect of `bun install` is required for the daemon to remain installable.

**Rationale:** A package.json change without the corresponding bun.lock update leaves the lockfile inconsistent with declared deps, breaking reproducible installs.

**Alternatives considered:**
- _Commit package.json only, leave bun.lock stale_ — rejected: breaks `bun install --frozen-lockfile` in CI / fresh clones.

**Reversibility:** Reverted as part of commit 4 revert.

### D8 — Companion plugin is NOT in scope  *(load-bearing)*

**Decision:** The companion plugin `@grudanov-nikolay/opencode-workshop-plugin` (separate repo at `~/workspase/projects/opencode-workshop-plugin/`) is NOT modified by this change. F-001 only touches the Workshop daemon repo.

**Rationale:** The plugin publishes to the local OTLP ingest endpoint, which is NOT in F-001's removal scope. The plugin has no cloud dependencies on its side (verified by `ai-docs/HANDOFF.md:15`).

**Alternatives considered:**
- _Audit the plugin for cloud references_ — rejected: out of scope for this repo's F-001; if needed, the plugin repo has its own PLAN.md.

**Reversibility:** N/A — non-action.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **`src/server.ts` has hidden cloud usages** beyond the imported symbols (e.g. inline `app.raindrop.ai` strings, conditional cloud branches) | Worker does a full `grep -nE "cloud\\|raindrop\\.ai\\|app\\.raindrop\\|cloudMcp\\|cloudSetup\\|writeKey" src/server.ts` in commit 1 and resolves every match before committing. Per-commit grep assertion. |
| **Commit 2 breaks the daemon** if `src/auth/login.ts` is imported by something other than `src/index.ts` | Worker greps `grep -rn "from \"\\./auth\\|from \"\\./auth/" src/` to enumerate all importers in commit 2 prep; any non-`src/index.ts` importer is handled in commit 2 before deletion. |
| **Commit 3 `install.sh` edit breaks the installer** (install.sh is 21K+ bytes with many branches) | Worker runs `bash install.sh --help` and `bash -n install.sh` (syntax check) before committing. If possible, test `bash install.sh --dry-run` (or equivalent) without actually installing. |
| **Commit 4 removes a dep that has hidden importers** (e.g. `@clack/prompts` used by an example file under `examples/`) | Worker's audit grep covers `src/`, `app/`, `scripts/`, `bin/`, AND `examples/`. Any hit outside deleted scope blocks the removal; commit message documents the decision. |
| **`bun.lock` conflict on future upstream sync** | Acceptable: bun.lock conflicts are routine and resolve via `bun install`. The fork will eventually break from upstream anyway (cloud code is gone). |
| **Smoke test cannot run** because user is unavailable to grant daemon-start permission | Commit 5 PLAN.md closeout proceeds with grep sweep + build pass; smoke test is marked "pending user permission" in the commit body and tracked as a follow-up. Plan closeout is NOT blocked by smoke test. |
| **Future F-002 (Codex/Claude) work references cloud-audit results from F-001's commit 4** | Commit 4's audit findings are documented in the commit body and in `ai-docs/PLAN.md` F-001 closeout note; F-002 worker reads them. |
| **`src/agent-chat.ts` has more cloud-related code than just `cloudMcpUrl`** (e.g. comments, helper functions) | Worker reads `src/agent-chat.ts` lines 140-200 in commit 1 prep; any cloud-related code block is removed alongside `cloudMcpUrl`. The non-cloud parts of `agent-chat.ts` (legitimate local chat helpers) stay. |
| **Process docs (ai-docs/HANDOFF.md, ai-docs/AGENTS.md) reference cloud removal as "pending"** | Out of scope for F-001 code commits. Commit 5 updates PLAN.md only. HANDOFF.md and AGENTS.md cloud-mention updates are a separate doc-maintenance task; the F-001 commit-5 grep sweep covers `src/`, not `ai-docs/`. |

## Migration Plan

**Deployment:** This is a fork-internal change. No external deployment — users run `bun run dev` from the repo or install via the fork's install.sh. After F-001 lands:
1. Existing local users (just Kolya + any contributor) re-run `bash install.sh` to get the cleaned installer (commit 3 state).
2. Existing daemon process must be restarted by the user (with explicit permission per `ai-docs/HANDOFF.md:67`) to pick up the cloud-stripped binary.
3. Existing `~/.raindrop/` directory is untouched — local SQLite DB persists, no data migration.

**Rollback:** `git revert <commit5> <commit4> <commit3> <commit2> <commit1>` (in reverse order) restores the pre-F-001 state. Or `git reset --hard <commit-before-F-001>` if the user prefers a hard reset (only if F-001 has not been pushed).

**Compatibility:** The companion plugin (`@grudanov-nikolay/opencode-workshop-plugin@0.1.0-kolya.6`) is unaffected — it talks to the local OTLP ingest endpoint, which F-001 does not touch. No plugin version bump required.

## Open Questions

1. **Should `bin/raindrop-dev` cloud references (if any) be removed in commit 3 or in a separate commit?** — Decision: commit 3, since `bin/raindrop-dev` is part of the installer-facing surface and follows the same cleanup logic. Worker verifies via grep in commit 3 prep.

2. **Should commit 5 also update `ai-docs/HANDOFF.md` to reflect F-001 completion?** — Decision: NO. HANDOFF.md is a session-snapshot doc; updating it is part of session-end housekeeping, not part of F-001's code-closeout. The grep sweep in commit 5 targets `src/`, not `ai-docs/`.

3. **What if commit 4's audit reveals `@clack/prompts` is used by both cloud code AND kept code?** — Decision: keep the dep, document the finding in the commit body, do not partial-remove. The dep stays in package.json as a known shared utility.

4. **Should F-001 closeout in PLAN.md mention the OpenSpec change name?** — Decision: YES. The Closed Features entry references `Openspec change: remove-cloud-integration-f001` for traceability.
