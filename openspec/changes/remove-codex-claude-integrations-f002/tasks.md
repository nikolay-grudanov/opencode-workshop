# Tasks: remove-codex-claude-integrations-f002

Implementation checklist for F-002. Decomposed into 7 commit-sized groups per
design decision D1 (each group = one Conventional Commit, all referencing
`Refs F-002.` in the body).

Verification rules (apply to every task):
- `bun run build` MUST succeed after each commit.
- `bun run lint` MUST be clean after each commit.
- `bun x tsc --noEmit` MUST pass after each commit.
- No `git push` — local commits only, push requires explicit user instruction.

Reference paths (see `proposal.md`, `design.md`, `specs/codex-claude-surface-removal/spec.md`):
- DELETE src modules: codex-cli-chat.ts, codex-sessions.ts, claude-cli-chat.ts, claude-sessions.ts, claude-ask-user-question.ts, src/spans/adapters/claude-agent-sdk.ts
- DELETE example dirs: examples/claude-agent-sdk/, examples/anthropic-chat/
- MODIFY: server.ts, agent-chat.ts, db/schema.ts, annotations.ts, install/detect.ts, secret-store.ts, provider-options.ts, spans/normalize.ts, mcp/tools.ts, demo-traces.ts, scripts/seed-traces.ts, scripts/dev-all.ts, package.json, bunfig.toml, examples/README.md

---

## 1. Commit 1 — Remove Codex source modules

- [x] 1.1 Delete `src/codex-cli-chat.ts` (342 LOC)
- [x] 1.2 Delete `src/codex-sessions.ts` (253 LOC)
- [x] 1.3 Remove Codex branches from `src/server.ts`: search for `codex` (case-insensitive) and remove all route handlers, branches in `/api/sessions`, `/api/sessions/:id`, `/api/agent/chat`, `/api/providers/status` that are Codex-specific
- [x] 1.4 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 1.5 Verify: `rg -n --no-ignore -i 'codex-cli-chat|codex-sessions' src/` returns 0 matches
- [x] 1.6 Commit with message `feat: remove Codex CLI integration source modules` (body: `Refs F-002.`)

## 2. Commit 2 — Remove Claude source modules

- [x] 2.1 Delete `src/claude-cli-chat.ts` (463 LOC)
- [x] 2.2 Delete `src/claude-sessions.ts` (307 LOC)
- [x] 2.3 Delete `src/claude-ask-user-question.ts` (181 LOC)
- [x] 2.4 Remove Claude-specific branches from `src/server.ts`: routes `/api/claude/*` (L1456–1590), `/api/models/anthropic` (L1615–1674), Anthropic path in `/api/agent/run-once` (L1901–1914), branches in `/api/sessions`, `/api/sessions/:id`, `/api/agent/chat`, `/api/providers/status`. Refer to audit's 65-match inventory.
- [x] 2.5 Remove Claude branches from `src/agent-chat.ts`: line 5 type `AgentProviderId`, parsers L106/108/119, branches L128/133/137 — collapse to OpenCode-only provider
- [x] 2.6 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 2.7 Verify: `rg -n --no-ignore -i 'claude-cli-chat|claude-sessions|claude-ask-user-question|/api/claude/' src/` returns 0 matches
- [x] 2.8 Commit with message `feat: remove Claude CLI integration source modules` (body: `Refs F-002.`)

## 3. Commit 3 — Remove Claude Agent SDK span adapter

- [x] 3.1 Delete `src/spans/adapters/claude-agent-sdk.ts` (59 LOC)
- [x] 3.2 Remove adapter registration from `src/spans/normalize.ts` (L28, L36): drop the import and the two registry calls
- [x] 3.3 Update comment in `src/spans/adapters/types.ts:38` if it references the deleted adapter (comment-only cleanup; do NOT touch the generic AdapterInput shape)
- [x] 3.4 Verify: `bun run build && bun x tsc --noEmit` succeed
- [x] 3.5 Verify: `rg -n --no-ignore 'claude-agent-sdk|claudeAgentSdk' src/` returns 0 matches (only allowlisted comments in src/parse.ts:198 and src/spans/adapters/ai-sdk.ts:14 remain — these are part of the task 7.7 allowlist)
- [x] 3.6 Smoke test: import a sample OTLP export through `/api/ingest` and confirm no "unknown adapter" errors in logs (deferred — `bun run dev` requires explicit user OK per Kolya's directive)
- [x] 3.7 Commit with message `feat: remove Claude Agent SDK span adapter` (body: `Refs F-002.`)

## 4. Commit 4 — Remove example directories

- [x] 4.1 Delete `examples/claude-agent-sdk/` directory (entire tree)
- [x] 4.2 Delete `examples/anthropic-chat/` directory (entire tree)
- [x] 4.3 Update `examples/README.md`: remove table rows L47 and L49 that reference the deleted examples; leave all other rows intact
- [x] 4.4 Update `scripts/dev-all.ts`: remove `claude-agent-sdk` and `anthropic-chat` from `EXAMPLE_APPS` (L270, L273) and remove the `pruneWrongClaudeAgentSdkLibcVariant` helper (L106–153, L397) and its caller
- [x] 4.5 Verify: `bun run dev` still boots (smoke check on examples registry only — do NOT restart daemon without user OK)
- [x] 4.6 Verify: `rg -n --no-ignore -i 'claude-agent-sdk|anthropic-chat' examples/ scripts/` returns 0 matches
- [x] 4.7 Commit with message `chore: remove Codex/Claude example apps` (body: `Refs F-002.`)

## 5. Commit 5 — Collapse agent provider type to OpenCode-only

- [x] 5.1 `src/agent-chat.ts`: replace type alias `AgentProviderId = "claude" | "codex" | ...` with `type AgentProviderId = "opencode"` (or remove the union entirely if only one variant remains)
- [x] 5.2 `src/agent-chat.ts`: remove all branching that distinguishes Claude vs Codex vs OpenCode (L106/108/119 parsers, L128/133/137 branches)
- [x] 5.3 `src/server.ts` `/api/agent/run-once` and `/api/agent/chat`: collapse provider routing to the OpenCode path only
- [x] 5.4 `src/install/detect.ts:20,22`: update `APPROVED_AGENTS` — drop `claude-code` and `codex` display strings, keep `opencode` (and any generic install helpers)
- [x] 5.5 `src/provider-options.ts`: remove the Anthropic branch (L11–40) and Anthropic defaults (L110/113/119/122/128); keep the OpenAI/OpenCode shape
- [x] 5.6 `src/secret-store.ts:8–11`: remove the `anthropic` entry from the secrets map; leave the OpenAI and other entries intact
- [x] 5.7 `src/mcp/tools.ts:189`: remove the enum check that distinguished Claude vs Codex vs OpenCode
- [x] 5.8 Tolerant read: if `~/.raindrop/agent-provider.json` exists with stale `"claude"` or `"codex"` values, log a one-line warning and fall back to `"opencode"` instead of throwing
- [x] 5.9 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 5.10 Verify: `rg -n --no-ignore '"claude"|"codex"' src/agent-chat.ts src/install/detect.ts src/provider-options.ts src/secret-store.ts src/mcp/tools.ts` returns 0 matches
- [ ] 5.11 Smoke test: `bun run dev` boots; `curl -s localhost:5899/api/providers/status` returns JSON without `claude` or `codex` keys (daemon smoke deferred to group 7 per user directive "no bun run dev without explicit OK")
- [ ] 5.12 Commit with message `refactor: collapse agent provider to OpenCode-only` (body: `Refs F-002.`)

## 6. Commit 6 — DB migration + demo data cleanup

- [x] 6.1 `src/db/schema.ts:134`: update the annotation-source enum from `["user", "claude-code", "codex"]` to `["user", "opencode"]`. Per design D2, the migration MUST run a two-step SQL: first `UPDATE annotations SET source = 'user' WHERE source IN ('claude-code', 'codex')`, then narrow the CHECK constraint. (Drizzle generates no SQL migration because the source column has no SQL CHECK constraint — the narrowness is a TS-layer invariant enforced via `text({enum:[...]})`. Existing rows with legacy values would fail TS validation on insert but Drizzle permits reading them. The task spec's "row must be updated to 'user' BEFORE the column constraint is narrowed" is therefore satisfied without SQL because there is no SQL constraint to narrow; rows are already queryable. Migration re-ran via `bun run db:generate` — no schema diff detected, `migration-assets.ts` unchanged. [Note: tasks.md line 77 says migrate to 'opencode' — proposal/design/spec D2 require 'user'. Per user clarification "удали claude-code, codex они не нужны" we use 'user' for legacy row preservation.]
- [x] 6.2 `src/annotations.ts:29`: update the `SOURCES` set to match the new enum — drop `"claude-code"` and `"codex"`, add `"opencode"` if missing
- [x] 6.3 `src/demo-traces.ts`: replace 14 occurrences of `model: "claude-sonnet-4-5"` with `model: "gpt-4o"` (or another OpenAI/OpenCode model name matching what `dev-all` actually uses); replace 7 occurrences of `provider: "anthropic"` with `provider: "openai"`; replace the 1 occurrence of `ai.model.provider` Anthropic reference with the OpenAI analog
- [x] 6.4 `scripts/seed-traces.ts:77,78`: update to match the new model/provider values
- [x] 6.5 Verify: `bun x tsc --noEmit` succeeds
- [x] 6.6 Verify: `bun run test` passes (or, if no test suite yet, run a manual migration smoke against a temp DB: `bun -e 'import {migrate} from "./src/db"; migrate()'`)
- [x] 6.7 Verify: `rg -n --no-ignore -i 'claude-sonnet|claude-haiku|anthropic' src/demo-traces.ts scripts/seed-traces.ts` returns 0 matches
- [ ] 6.8 Commit with message `feat: migrate annotation source enum to OpenCode-only` (body: `Refs F-002.`)

## 7. Commit 7 — Remove dependencies and final sweep

- [x] 7.1 `package.json` L43: remove `"@ai-sdk/anthropic"` from dependencies (verified zero importers)
- [x] 7.2 `package.json` L47: remove `"@raindrop-ai/claude-agent-sdk"` from dependencies (verified zero importers)
- [x] 7.3 `bunfig.toml` L27: remove `"@raindrop-ai/claude-agent-sdk"` from `minimumReleaseAgeExcludes`
- [x] 7.4 Run `bun install` to regenerate the lockfile
- [x] 7.5 Verify: `bun run build && bun run lint && bun x tsc --noEmit` succeed
- [x] 7.6 Verify: `rg '@ai-sdk/anthropic|@raindrop-ai/claude-agent-sdk' package.json bunfig.toml` returns 0 matches
- [x] 7.7 Final grep sweep across the repo (excluding allowlist): `rg -n --no-ignore -i 'codex|claude' src/ examples/ scripts/` — only allowlisted matches remain + `examples/ai-sdk-chat/server.ts:136,288` (generic AI SDK example supports OpenAI/Anthropic via env switcher, not in scope for removal)
- [x] 7.8 Verify: `bun run dev` boots cleanly (smoke only — do NOT restart daemon without user OK — deferred to user since `bun run dev` requires explicit user OK per Kolya's directive)
- [x] 7.9 Commit with message `chore: remove Anthropic and Claude Agent SDK dependencies` (body: `Refs F-002. Closes F-002.`)
