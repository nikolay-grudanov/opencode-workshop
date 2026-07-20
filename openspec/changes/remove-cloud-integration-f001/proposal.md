## Why

`ai-docs/PLAN.md:179-223` (F-001) and `ai-docs/HANDOFF.md:18-19` lock in the fork's reason for existing: **local debugger only**. Every `src/cloud/*` and `src/auth/*` file is dead weight — `app.raindrop.ai` is never called by the local-only stack (OpenCode → opencode-workshop-plugin → daemon on `localhost:5899`), and cloud wiring in `src/server.ts:50-54,693` plus `src/index.ts:46,824,827` is a runtime liability (every cloud import is a chunk the daemon loads but never uses, plus a class of bugs like `apiKeyHealth` 401 noise in logs).

The previous planning attempt (`.omo/drafts/docs-and-cloud-removal.md`) bundled F-001 with docs restoration and required Metis + Momus + Oracle dual review, which stalled (`pending-action` field never resolved). This OpenSpec change is F-001 only, scoped to **exactly 5 commits** matching Kolya's "5-7 commits for F-001" preference (`ai-docs/HANDOFF.md:61`).

## What Changes

Removes the entire cloud SaaS surface from the fork in five atomic commits, each independently verifiable against the regression bar: **local daemon starts, OpenCode trace streams, UI renders the run, no cloud references in grep sweep.**

- **Commit 1 — `src/cloud/` directory removal (12 files)**: delete `apply.ts`, `cloud-mcp-proxy.ts`, `constants.ts`, `env-file.ts`, `import-trace.ts`, `offer.ts`, `query-client.ts`, `query-key.ts`, `setup.ts`, `skills.ts`, `transient-keys.ts`, `uninstall.ts`. Fix every importer in `src/server.ts:50-54,693` and any other caller.
- **Commit 2 — `src/auth/` directory removal (5 files)**: delete `constants.ts`, `login.ts`, `oauth.ts`, `token-store.ts`, `write-key.ts`. Remove `cmdLogin`/`cmdLogout` wiring from `src/index.ts:46,824,827` and drop `raindrop login` / `raindrop logout` CLI commands.
- **Commit 3 — `install.sh`, `bin/raindrop-dev`, `README.md` cleanup**: strip `--cloud` flag (`install.sh:316`), `RAINDROP_CLOUD` env (`install.sh:327,342-344`), `setup_cmd=(cloud setup)` (`install.sh:729`), help-text blocks (`install.sh:281-282,319`). Remove the entire "Raindrop Cloud" section from `README.md:49-103` and cloud CLI entries from `README.md:130-133`. Audit `bin/raindrop-dev` for cloud references.
- **Commit 4 — `package.json` deps audit**: audit `@clack/prompts@^1.3.0` (L45) and `@raindrop-ai/ai-sdk@^0.0.24` (L47) — remove IF and ONLY IF audit confirms cloud-only usage and no remaining importer after commits 1-3. KEEP `raindrop-ai@^0.0.89` (L56, daemon parts) and `@ai-sdk/openai@^3.0.26` (L44, OpenCode provider support).
- **Commit 5 — final grep sweep + PLAN.md closeout**: `grep -rn "raindrop\.ai\|apiKeyHealth\|RAINDROP_CLOUD\|app\.raindrop\|cloud setup\|cloudMcp\|writeKey\|write_key\|cmdLogin\|cmdLogout\|cloud-mcp"` across repo; clean residuals. Flip PLAN.md F-001 checkboxes (`ai-docs/PLAN.md:213-223`) to `[x]` and move F-001 to "Closed Features" section (`ai-docs/PLAN.md:237-239`).

## Capabilities

### New Capabilities

- `cloud-surface-removal`: The fork's daemon, CLI, installer, README, and deps no longer reference, import, or execute any cloud SaaS code. Verifiable by grep assertion, build pass, and the smoke test.
- `auth-surface-removal`: The fork no longer ships OAuth login, write-key storage, or token storage. Local daemon works without credentials.
- `f001-plan-closeout`: `ai-docs/PLAN.md` reflects the completed F-001 (checkboxes flipped, entry moved to Closed Features).

### Modified Capabilities

_None._ No existing specs in `openspec/specs/` — F-001 is the first OpenSpec change for this repo's code. Future changes (F-002..F-005) will reference this change's grep sweep as a baseline.

## Impact

**Files deleted (17):**
- `src/cloud/` — 12 files: `apply.ts`, `cloud-mcp-proxy.ts`, `constants.ts`, `env-file.ts`, `import-trace.ts`, `offer.ts`, `query-client.ts`, `query-key.ts`, `setup.ts`, `skills.ts`, `transient-keys.ts`, `uninstall.ts`.
- `src/auth/` — 5 files: `constants.ts`, `login.ts`, `oauth.ts`, `token-store.ts`, `write-key.ts`.

**Files modified (4):**
- `src/server.ts` — drop cloud imports L50-54, drop `cloudMcpUrl` from `./agent-chat` import L27, drop `upstreamUrl: () => cloudMcpUrl()` at L693, drop any code block using these symbols.
- `src/index.ts` — drop `cmdLogin`/`cmdLogout` import L46, drop their case branches L824,L827, drop `raindrop login`/`raindrop logout` from CLI help text.
- `install.sh` — strip `--cloud` flag handling, `RAINDROP_CLOUD` env var, `setup_cmd=(cloud setup)` branch, cloud-related help text.
- `README.md` — remove "Raindrop Cloud" prose section (L49-103) and cloud CLI entries (L130-133).

**Files possibly modified (depends on commit 4 audit):**
- `package.json` — drop `@clack/prompts` and/or `@raindrop-ai/ai-sdk` IF audit confirms cloud-only. KEEP `raindrop-ai`, `@ai-sdk/openai`.
- `bun.lock` — auto-updated by `bun install` after package.json changes (NOTE: `ai-docs/AGENTS.md:59` flags `bun.lock` as upstream-owned; commit message must call out the bun.lock touch as forced by deps removal).

**Files modified in commit 5 (PLAN.md closeout only):**
- `ai-docs/PLAN.md` — flip F-001 checkboxes L213-223, move F-001 entry from Active to Closed Features section.

**Scope OUT (must NOT be touched by this change):**
- ❌ F-002 work (Codex / Claude Code / Anthropic removal): `src/codex-cli-chat.ts`, `src/codex-sessions.ts`, `src/claude-cli-chat.ts`, `src/spans/adapters/claude-agent-sdk.ts`, `examples/{claude-agent-sdk,anthropic-chat}/`, deps `@ai-sdk/anthropic` (L43), `@raindrop-ai/claude-agent-sdk` (L48). Separate F-002 change.
- ❌ F-003 / F-004 / F-005 work — separate changes.
- ❌ Removing `raindrop-ai@^0.0.89` (L56) — load-bearing for daemon primitives (`ai-docs/HANDOFF.md:40`). F-009-class scope.
- ❌ Removing `@ai-sdk/openai@^3.0.26` (L44) — load-bearing for OpenCode provider support (`ai-docs/PLAN.md:160`).
- ❌ Repo-root `AGENTS.md` (upstream-owned; `ai-docs/AGENTS.md:55-59`).
- ❌ `docs/` directory (upstream-owned).
- ❌ `LICENSE` (upstream-owned).
- ❌ Creating a `tests/` directory — out of F-001 scope; the missing-tests gap is documented in DEVELOPMENT.md by the docs change.
- ❌ `git push` without explicit user "push" instruction (`ai-docs/HANDOFF.md:59`).
- ❌ Restarting the daemon or OpenCode without explicit OK (`ai-docs/HANDOFF.md:67`). Smoke test in commit 5 requires explicit user permission to start the daemon.

**Runtime impact:** POSITIVE — daemon binary shrinks, no cloud error noise, no transitive cloud dependency surprise. NEGATIVE — none expected; cloud was never reachable from the local-only stack.

**Compatibility:** Companion plugin `@grudanov-nikolay/opencode-workshop-plugin@0.1.0-kolya.6` (separate repo, `ai-docs/HANDOFF.md:15`) is unaffected — it publishes to the local ingest endpoint, which is NOT in scope for removal. F-001 does not change the OTLP ingest API.

**Risk:** Medium. Surface removal across 17 deleted files + 4-6 modified files has non-trivial blast radius (especially `src/server.ts` at 2550 LOC). Mitigation: per-commit `bun run build` + `bun x tsc --noEmit` + per-commit grep assertion. Final smoke test (commit 5) requires user OK to start the daemon.
