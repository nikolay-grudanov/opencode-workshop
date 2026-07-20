# Implementation Tasks — remove-cloud-integration-f001

F-001 ships in exactly **5 commits**. Each commit task block has its own verification. After the 5 commits, an explicit user-permission gate covers the smoke test. Follow the commit order strictly — D1 in design.md is load-bearing.

Hard rules (apply to every task):
- NEVER `git push` (requires explicit user "push").
- NEVER start the daemon or OpenCode without explicit user OK (only the smoke test task asks for this).
- NEVER edit upstream-owned files: `docs/`, root `AGENTS.md`, `LICENSE`. `bun.lock` is allowed to auto-update from `bun install` ONLY in Task 4 (D7).
- Each commit message uses Conventional Commits format and ends with a body line `Refs F-001.`.
- Per-commit verification MUST pass before `git commit`. If verification fails, fix the cause before committing — do NOT skip the verification step.

---

## Task 1 — Commit C1: Remove `src/cloud/` SaaS surface

**Goal:** Delete the 12-file `src/cloud/` directory, strip all cloud wiring from `src/server.ts`, and remove the unused `cloudMcpUrl()` helper from `src/agent-chat.ts`. After this commit, no `./cloud/*` import exists anywhere in `src/`.

**Steps:**

1. **Reconnaissance (do not commit):** Run from repo root to enumerate every cloud reference in `src/server.ts`:
   ```bash
   grep -nE "from \"\\./cloud|cloudMcpUrl|importCloudTrace|queryApiGet|normalizeQueryApiKey|TransientQueryApiKeyStore|CLOUD_MCP_PROXY_PATH|bearerTokenFromHeader|createCloudMcpProxy|cloudSetup|cloud\\.ai|app\\.raindrop" src/server.ts src/agent-chat.ts
   ```
   Save output to a scratch note (NOT committed). Expected matches per compressed-context ground truth:
   - `src/server.ts:27` — `cloudMcpUrl` import
   - `src/server.ts:50` — `importCloudTrace, ImportCloudTraceRefused` import
   - `src/server.ts:51` — `QueryApiError, queryApiGet` import
   - `src/server.ts:52` — `normalizeQueryApiKey` import
   - `src/server.ts:53` — `TransientQueryApiKeyStore` import
   - `src/server.ts:54` — `CLOUD_MCP_PROXY_PATH, bearerTokenFromHeader, createCloudMcpProxy` import
   - `src/server.ts:693` — `upstreamUrl: () => cloudMcpUrl()` usage
   - `src/agent-chat.ts:150` — `cloudMcpUrl` definition
   - `src/agent-chat.ts:158` — comment about Raindrop Query API key (clean up)
   - Any additional matches the grep finds that ground truth didn't list — investigate each.

2. **Enumerate cloud consumers across whole `src/`:** Confirm `src/cloud/*` is only imported by `src/server.ts`:
   ```bash
   grep -rn "from \"\\./cloud\\|from \"\\.\\./cloud\\|from \"\\./cloud/" src/
   ```
   Expected: only `src/server.ts`. If any other file imports from `./cloud/`, expand Task 1 to fix that file too (do not defer to a later task).

3. **Read `src/server.ts` and `src/agent-chat.ts`** to find every code block that uses the symbols from step 1 (not just import lines — also call sites, conditional branches, comments). Mark each location for editing.

4. **Edit `src/server.ts`:**
   - Remove imports at L27 (`cloudMcpUrl` from `./agent-chat`) — but ONLY the `cloudMcpUrl` symbol; if other symbols come from `./agent-chat`, keep them.
   - Remove imports at L50-54 (entire 5 import lines).
   - Remove or refactor every code block that referenced the deleted symbols. For pure cloud-routing blocks: delete. For branches where cloud was optional: keep the local-only branch, drop the cloud branch.
   - Remove `upstreamUrl: () => cloudMcpUrl()` at L693 (and any surrounding object literal it was part of — only if that property was cloud-only).
   - Run `bun x tsc --noEmit` after edits to catch any unresolved symbol.

5. **Edit `src/agent-chat.ts`:**
   - Remove the `cloudMcpUrl()` function definition at L150.
   - Remove the L158 comment about Raindrop Query API key.
   - Read lines 140-200 to find any other cloud-related code blocks (helper functions, type declarations). Remove them. Keep the legitimate local chat helpers (`agentChat`, etc.).

6. **Delete `src/cloud/`:**
   ```bash
   rm -rf src/cloud/
   ```

7. **Verify per-commit regression bar:**
   ```bash
   bun run build            # MUST exit 0
   bun x tsc --noEmit       # MUST exit 0, no missing-module errors
   grep -rn "from \"\\./cloud\\|cloudMcpUrl\\|importCloudTrace\\|queryApiGet\\|normalizeQueryApiKey\\|TransientQueryApiKeyStore\\|CLOUD_MCP_PROXY_PATH\\|createCloudMcpProxy" src/
   # ^ last command MUST return zero matches
   ```

8. **Stage and commit:**
   ```bash
   git add -A
   git status               # confirm only expected files staged
   git diff --cached --stat # confirm no surprises (e.g. accidental docs/ edit)
   git commit -m "refactor: remove src/cloud/ SaaS surface

   Delete 12-file src/cloud/ directory and strip all cloud wiring from
   src/server.ts (imports L27, L50-54, usage L693) and src/agent-chat.ts
   (cloudMcpUrl L150). Local-only stack is unchanged.

   Refs F-001."
   ```

**Done when:** Commit C1 is on disk, build passes, grep returns zero cloud imports in `src/`.

**Scope guard:** No edits to `src/auth/` (Task 2), no edits to `install.sh`/`README.md` (Task 3), no edits to `package.json` (Task 4). If any of those need touching, STOP and revise the plan before proceeding.

---

## Task 2 — Commit C2: Remove `src/auth/` OAuth + write-key surface

**Goal:** Delete the 5-file `src/auth/` directory (including `oauth.ts` per design D3) and remove the `cmdLogin`/`cmdLogout` wiring from `src/index.ts`. After this commit, no `./auth/*` import exists anywhere in `src/`.

**Steps:**

1. **Reconnaissance (do not commit):** Enumerate every auth reference:
   ```bash
   grep -rn "from \"\\./auth\\|from \"\\./auth/" src/
   grep -nE "cmdLogin|cmdLogout|oauth|OAuth|writeKey|write_key|RAINDROP_WRITE_KEY|RAINDROP_TOKEN|token-store" src/index.ts
   ```
   Save output to a scratch note. Expected matches per compressed-context ground truth:
   - `src/index.ts:46` — imports `cmdLogin, cmdLogout` from `./auth/login`
   - `src/index.ts:824` — `cmdLogin` invocation/case branch
   - `src/index.ts:827` — `cmdLogout` invocation/case branch
   - Any non-`src/index.ts` importer of `./auth/*` — investigate each. If found, expand Task 2.

2. **Edit `src/index.ts`:**
   - Remove import at L46 (`cmdLogin, cmdLogout`).
   - Remove case branches at L824 and L827.
   - Read surrounding context (CLI dispatcher, help text). Remove `login`, `logout`, `cloud setup`, `cloud uninstall` from help text if present.
   - Run `bun x tsc --noEmit` to catch unresolved symbols.

3. **Delete `src/auth/`:**
   ```bash
   rm -rf src/auth/
   ```

4. **Verify per-commit regression bar:**
   ```bash
   bun run build            # MUST exit 0
   bun x tsc --noEmit       # MUST exit 0
   grep -rn "from \"\\./auth\\|cmdLogin\\|cmdLogout\\|RAINDROP_WRITE_KEY\\|RAINDROP_TOKEN\\|token-store" src/
   # ^ MUST return zero matches

   # Behavioral check: bun src/index.ts login should be unknown command
   bun src/index.ts login 2>&1 | grep -i "unknown\\|not.*command\\|unrecognized"
   # ^ expect a match
   ```

5. **Stage and commit:**
   ```bash
   git add -A
   git diff --cached --stat
   git commit -m "refactor: remove src/auth/ OAuth + write-key surface

   Delete 5-file src/auth/ directory (constants, login, oauth,
   token-store, write-key — note: oauth.ts was missed in PLAN.md
   F-001 enumeration, see design.md D3). Remove cmdLogin/cmdLogout
   wiring from src/index.ts (L46, L824, L827). Local daemon works
   without credentials.

   Refs F-001."
   ```

**Done when:** Commit C2 is on disk, build passes, `bun src/index.ts login` is unknown command, grep returns zero auth imports in `src/`.

**Scope guard:** No edits to `install.sh`/`README.md` (Task 3), no edits to `package.json` (Task 4).

---

## Task 3 — Commit C3: Strip cloud references from installer, README, bin/

**Goal:** Remove the `--cloud` flag, `RAINDROP_CLOUD` env handling, cloud-setup branch, and cloud help text from `install.sh`. Remove the entire "Raindrop Cloud" section and cloud CLI entries from `README.md`. Audit and clean `bin/raindrop-dev` of cloud references.

**Steps:**

1. **Reconnaissance (do not commit):**
   ```bash
   # install.sh cloud refs
   grep -nE "cloud|RAINDROP_CLOUD|--cloud|cloud\\.ai|app\\.raindrop" install.sh
   # README cloud refs
   grep -nE "cloud|RAINDROP_CLOUD|app\\.raindrop|raindrop\\.ai/cloud|OAuth|write.?key" README.md
   # bin/raindrop-dev audit
   ls -la bin/
   grep -nE "cloud|RAINDROP_CLOUD|app\\.raindrop|raindrop\\.ai/cloud|OAuth|write.?key|cmdLogin|cmdLogout" bin/* 2>/dev/null || true
   ```
   Save output to a scratch note. Expected matches per compressed-context ground truth:
   - `install.sh:281-282` (help text), `install.sh:316` (`--cloud` flag), `install.sh:319` (Usage), `install.sh:327` (`RAINDROP_CLOUD` env var), `install.sh:342-344` (description), `install.sh:726`, `install.sh:729` (`setup_cmd=(cloud setup)` branch).
   - `README.md:49-103` (full "Raindrop Cloud" section), `README.md:130-133` (cloud CLI entries).
   - `bin/raindrop-dev`: investigate any cloud references found.

2. **Edit `install.sh`:** For each line found in step 1:
   - Help text mentions (L281-282, L319, L342-344): delete the cloud-related help lines; keep local-debugger help intact.
   - `--cloud` flag (L316): delete the flag-parsing case.
   - `RAINDROP_CLOUD` env var reads (L327, L342-344): delete the reads and any conditional branches that test the var.
   - `setup_cmd=(cloud setup)` branch (L726, L729): delete the cloud-setup dispatch; keep the local-setup dispatch as the only path.
   - Run `bash -n install.sh` for syntax check.

3. **Edit `README.md`:**
   - Remove lines L49-103 (the entire "Raindrop Cloud" section, including subsections and code blocks). If the section starts and ends with horizontal rules (`---`), remove the rules too unless they're shared with adjacent sections.
   - Remove lines L130-133 (cloud CLI entries from the commands list).
   - Preserve all local-debugger content. The README should still make sense as a standalone local-debugger guide.

4. **Edit `bin/raindrop-dev` (conditional):** If the audit in step 1 found cloud references, remove them. If the file is clean, skip.

5. **Verify per-commit regression bar:**
   ```bash
   bash -n install.sh        # MUST exit 0 (syntax check)
   bash install.sh --help 2>&1 | grep -i cloud
   # ^ MUST return zero matches (no cloud mention in installer help)

   grep -nE "cloud|RAINDROP_CLOUD|app\\.raindrop|raindrop\\.ai/cloud|OAuth|write.?key" README.md
   # ^ MUST return zero matches

   bun run build             # MUST still exit 0 (catches accidental src/ edits)
   ```

6. **Stage and commit:**
   ```bash
   git add install.sh README.md bin/
   git diff --cached --stat
   git commit -m "chore: strip cloud references from installer and README

   install.sh: drop --cloud flag (L316), RAINDROP_CLOUD env handling
   (L327, L342-344), setup_cmd=(cloud setup) branch (L729), and cloud
   help text (L281-282, L319, L342-344). Installer now runs local-
   debugger setup only.

   README.md: remove 'Raindrop Cloud' section (L49-103) and cloud CLI
   entries (L130-133). README is now local-debugger-only.

   bin/raindrop-dev: audit and clean (see diff).

   Refs F-001."
   ```

**Done when:** Commit C3 is on disk, `bash install.sh --help` shows no cloud, `README.md` has no cloud references, build still passes.

**Scope guard:** No edits to `package.json` (Task 4). No edits to `src/` (already cleaned in Tasks 1-2).

---

## Task 4 — Commit C4: Conditional deps audit and removal

**Goal:** Audit `@clack/prompts` (L45) and `@raindrop-ai/ai-sdk` (L47) for cloud-only usage. Remove them from `package.json` IF AND ONLY IF the audit confirms they are imported only by code deleted in Tasks 1-3. KEEP `raindrop-ai` (L56) and `@ai-sdk/openai` (L44) per design D5.

**Steps:**

1. **Audit grep across all source roots:**
   ```bash
   # @clack/prompts
   grep -rn "@clack/prompts\\|from \"@clack" src/ app/ scripts/ bin/ examples/ 2>/dev/null
   # @raindrop-ai/ai-sdk
   grep -rn "@raindrop-ai/ai-sdk\\|from \"@raindrop-ai/ai-sdk" src/ app/ scripts/ bin/ examples/ 2>/dev/null
   ```
   Document the FULL grep output in a scratch note. It will be quoted in the commit message.

2. **Decision matrix:**
   - **Zero matches** for a dep → it's unused. SAFE to remove.
   - **All matches are in `src/cloud/*` or `src/auth/*`** (already deleted in Tasks 1-2) → it's cloud-only. SAFE to remove.
   - **Any match is in a kept file** (e.g. `src/server.ts`, `src/agent-chat.ts`, `src/index.ts`, `app/`, `scripts/`, `bin/`, `examples/`) → KEEP the dep. Document the keeping in the commit message.

3. **Conditional edit of `package.json`:** For each dep confirmed removable, delete the line from the `dependencies` object. Use `edit` tool (not a regex).

4. **Install + verify:**
   ```bash
   bun install              # MUST exit 0; bun.lock auto-updates (allowed per D7)
   bun run build            # MUST exit 0
   bun x tsc --noEmit       # MUST exit 0
   ```

5. **Stage and commit (note: scope depends on audit result):**
   ```bash
   git add package.json bun.lock
   git diff --cached --stat
   git commit -m "chore(deps): drop cloud-only packages from package.json

   Audit result (grep at commit time):
   @clack/prompts: <paste grep result — 'no remaining importers' or specific files>
   @raindrop-ai/ai-sdk: <paste grep result — 'no remaining importers' or specific files>

   Removed: <list deps removed, or 'none — see audit above'>
   Kept: <list deps kept with reason, e.g. 'raindrop-ai (load-bearing daemon primitive, D5);
   @ai-sdk/openai (OpenCode provider, D5); @ai-sdk/anthropic and @raindrop-ai/claude-agent-sdk
   are F-002 scope, out of F-001'>

   bun.lock auto-updated by 'bun install' (allowed per design.md D7; bun.lock is upstream-owned
   but the lockfile MUST stay in sync with declared deps for reproducible installs).

   Refs F-001."
   ```

**Done when:** Commit C4 is on disk, audit decision is documented in the commit message, `bun install` + `bun run build` pass.

**Scope guard:** NEVER touch `@ai-sdk/anthropic` (L43), `@raindrop-ai/claude-agent-sdk` (L48) — those are F-002. NEVER touch `raindrop-ai` (L56) or `@ai-sdk/openai` (L44) per D5.

---

## Task 5 — Commit C5: Final grep sweep + PLAN.md F-001 closeout

**Goal:** Run a comprehensive grep sweep across the repo to catch any cloud reference residuals. Then flip PLAN.md F-001 checkboxes to `[x]` and move F-001 to the Closed Features section.

**Steps:**

1. **Comprehensive grep sweep:**
   ```bash
   # Source code sweep
   grep -rnE "raindrop\\.ai|apiKeyHealth|RAINDROP_CLOUD|app\\.raindrop|cloud setup|cloudMcp|writeKey|write_key|cmdLogin|cmdLogout|cloud-mcp|cloudMcpUrl" src/ app/ scripts/ bin/
   # ^ expect zero matches; if any, fix the residual file and amend the relevant prior commit
   #   (or add a new fixup commit if the prior commit is already pushed — but it is NOT pushed
   #   per the no-push rule)

   # Config + installer + README sweep
   grep -rnE "raindrop\\.ai|RAINDROP_CLOUD|cloud setup|cloudMcp|cloudMcpUrl|cmdLogin|cmdLogout" install.sh README.md bin/
   # ^ expect zero matches

   # PLAN.md F-001 entry sweep (only docs/PLAN-style files, not source)
   grep -nE "F-001" ai-docs/PLAN.md
   # ^ expect matches showing F-001 still listed under Active Features with [ ] checkboxes
   ```

2. **Resolve any residuals** found in step 1. If residuals are in `src/`, the relevant prior commit (C1 or C2) was incomplete — fix in a small amend-style commit folded into Task 5 (since we're not pushing, amending is fine; but safer to add a small follow-up commit within C5). Document the residuals in the C5 commit message.

3. **Edit `ai-docs/PLAN.md`:**
   - Read the F-001 entry in "## Active Features" (around L179-223).
   - Flip every `- [ ]` to `- [x]` in the F-001 todo list (L213-223 per compressed-context ground truth).
   - Move the F-001 entry from "## Active Features" to "## Closed Features" (around L237-239).
   - Remove the placeholder line `_(none yet — F-001 will land here once all todos are checked)_` (L239).
   - Add to the Closed Features F-001 entry a closing note: `Closed YYYY-MM-DD: cloud SaaS surface removed in 5 commits (C1: src/cloud/, C2: src/auth/, C3: install+README, C4: deps audit, C5: sweep + this closeout). Grep sweep clean. OpenSpec change: remove-cloud-integration-f001.` Replace `YYYY-MM-DD` with the commit date (today, Europe/Moscow tz).

4. **Verify PLAN.md edits:**
   ```bash
   grep -nE "^- \\[ \\]" ai-docs/PLAN.md | head -50
   # ^ confirm no open [ ] checkboxes remain in the F-001 block (other Features may still have [ ])
   grep -nE "F-001" ai-docs/PLAN.md
   # ^ confirm F-001 appears in Closed Features, NOT in Active Features
   ```

5. **Build still green:**
   ```bash
   bun run build            # MUST exit 0 (sanity — no src/ edits expected in C5)
   ```

6. **Stage and commit:**
   ```bash
   git add ai-docs/PLAN.md  # plus any residual files from step 2
   git diff --cached --stat
   git commit -m "chore: final grep sweep + close F-001 in PLAN.md

   Grep sweep result: <paste summary — '0 cloud references in src/, install.sh, README.md'>
   Residuals fixed in this commit: <list, or 'none'>

   ai-docs/PLAN.md: F-001 checkboxes flipped to [x], entry moved from
   Active Features to Closed Features with closing note.

   OpenSpec change: remove-cloud-integration-f001.

   Refs F-001."
   ```

**Done when:** Commit C5 is on disk, grep sweep is clean, PLAN.md shows F-001 in Closed Features with all checkboxes `[x]`, build still passes.

**Scope guard:** No edits to `docs/`, root `AGENTS.md`, `LICENSE` (upstream-owned). No edits to `src/` unless residual cleanup requires it.

---

## Task 6 — Smoke test (REQUIRES EXPLICIT USER PERMISSION — design D6)

**Goal:** End-to-end verification that the local-only stack works after F-001. **This task MUST prompt the user for permission to start the daemon.** Do NOT run `bun run dev` automatically.

**Steps:**

1. **Pause and ask the user.** Send a message like:
   > "F-001 commits C1-C5 are complete and the grep sweep is clean. The next step is the smoke test: I need to start the daemon with `bun run dev`, run an OpenCode session with the companion plugin, and verify a span lands in the local SQLite DB and renders in the UI. Per ai-docs/HANDOFF.md:67, I need your explicit OK before starting the daemon. Should I proceed?"

2. **If user says NO or is unavailable:** Mark Task 6 as `pending user permission` in the F-001 PLAN.md entry's closing note (amend C5 if needed, or document in the next session's HANDOFF). Stop here — F-001 is considered code-complete but smoke-test-pending.

3. **If user says YES:** Execute the regression bar scenarios:
   ```bash
   # Scenario a: build green
   bun install
   bun run build

   # Scenario b: daemon starts
   bun run dev &
   DAEMON_PID=$!
   sleep 5

   # Scenario c: daemon responds
   curl -fsS http://localhost:5899/api/runs?limit=1
   # ^ expect [] or JSON array of runs

   # Scenario d: UI renders
   # (manual check) open http://localhost:5899 in a browser, confirm UI loads

   # Scenario e: OpenCode trace streams
   # (manual check) the user runs an OpenCode session with the companion plugin
   # configured, then verifies a new run appears in the UI

   # Cleanup
   kill $DAEMON_PID
   ```

4. **Document the smoke test result** in a follow-up note (NOT a commit unless the user requests one). If the smoke test fails, do NOT revert — diagnose the root cause and propose a fix in a new OpenSpec change or a follow-up commit.

**Done when:** Smoke test passes all scenarios (with user permission), OR smoke test is documented as pending user permission per step 2.

---

## Final Acceptance Criteria

The change is fully done when ALL of the following are true:

1. Five commits exist on disk matching the design D1 order (cloud dir → auth dir → install/README → deps → sweep+PLAN.md).
2. Each commit is independently buildable (`bun run build` passes at every intermediate commit).
3. `grep -rnE "raindrop\\.ai|RAINDROP_CLOUD|cloudMcp|cloudMcpUrl|cmdLogin|cmdLogout|cloud-mcp" src/ install.sh README.md bin/` returns zero matches.
4. `ai-docs/PLAN.md` shows F-001 in Closed Features with all checkboxes `[x]` and a closing-date note.
5. `git log --grep="F-001" --oneline` returns exactly five commits.
6. Smoke test is either PASSED or documented as pending user permission.
7. Nothing has been pushed (`git log origin/main..HEAD` shows 5 commits ahead, 0 behind, no push performed).

If any criterion fails, the change is NOT done. Do not mark it applied until all seven pass.
