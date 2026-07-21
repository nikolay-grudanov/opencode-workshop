## Why

The fork convention in `ai-docs/AGENTS.md` is **OpenCode-only**: "NEVER add Codex / Claude Code / Anthropic-specific code." Yet ~1605 LOC of source plus two entire example directories inherited from upstream still carry Codex CLI, Claude Code CLI, Claude Agent SDK, and Anthropic-API surface area. These surfaces leak into `src/server.ts` (65 line matches), `src/agent-chat.ts` (provider branching), `src/db/schema.ts` (annotation-source enum), `src/provider-options.ts` (Anthropic branch), and elsewhere — blocking clean implementation of F-003..F-005 and forcing every reader to reason about three providers that the fork no longer ships. F-001 already removed the cloud/auth surface; F-002 finishes the job for Codex/Claude/Anthropic.

## What Changes

### Deletions (8 paths)

- **DELETE** `src/codex-cli-chat.ts` (342 LOC) — Codex CLI child-process wrapper.
- **DELETE** `src/codex-sessions.ts` (253 LOC) — `~/.codex/sessions` JSONL reader.
- **DELETE** `src/claude-cli-chat.ts` (463 LOC) — Claude Code CLI child-process wrapper.
- **DELETE** `src/claude-sessions.ts` (307 LOC) — `~/.claude/projects/...` JSONL reader.
- **DELETE** `src/claude-ask-user-question.ts` (181 LOC) — Claude `AskUserQuestion` IPC bridge.
- **DELETE** `src/spans/adapters/claude-agent-sdk.ts` (59 LOC) — Claude Agent SDK span normalizer.
- **DELETE** `examples/claude-agent-sdk/` (entire directory) — example app.
- **DELETE** `examples/anthropic-chat/` (entire directory) — example app.

### Route removals (in `src/server.ts`)

- **DELETE** `/api/claude/sessions`, `/api/claude/loadout`, `/api/claude/sessions/:id`, `/api/claude/ask-user-question/hook`, `/api/claude/ask-user-question/:id/answer`, `/api/claude/messages` (server.ts:1456–1590).
- **DELETE** `/api/models/anthropic` (server.ts:1615–1674).
- **DELETE** Codex/Claude branches in `/api/sessions`, `/api/sessions/:id`, `/api/agent/chat`, `/api/agent/run-once`, `/api/providers/status`.

### Schema changes (**BREAKING**)

- `src/db/schema.ts:134` — annotation `source` enum narrows from `["user","claude-code","codex"]` to `["user","opencode"]`. Triggers a new Drizzle migration. Existing rows with legacy values must be migrated to `"user"` (their semantics were already user-authored).
- `src/annotations.ts:29` — `SOURCES` set narrows to match.
- `src/mcp/tools.ts:189` — drop `claude-code` / `codex` annotation-source special casing.

### Provider model collapses to OpenCode-only

- `src/agent-chat.ts` — `AgentProviderId = "claude" | "codex"` → `"opencode"`. Drop `parseAgentProvider`, `agentAnnotationSource`, slash-command and capability branches. Net reduction ~25 LOC.
- `src/secret-store.ts:8–11` — drop `anthropic` secret entry (`ANTHROPIC_API_KEY`).
- `src/provider-options.ts` — drop `anthropic()` branch (L11–40), drop Anthropic defaults in `detectProvider`/`getProviderBaseURL`/`getProviderHeaders` (~35 LOC reduction).
- `src/install/detect.ts:20,22` — drop `"claude-code"` and `"codex"` from `APPROVED_AGENTS` (after confirming `agent-install@^0.0.5` declares those IDs independently — strings here are display-only).
- `src/spans/normalize.ts:28,36` — drop `claudeAgentSdkLlmAdapter` import + registration.

### Demo / seed data

- `src/demo-traces.ts` — replace 14× `model: "claude-sonnet-4-5"` + 7× `provider: "anthropic"` + 1× `ai.model.provider: "anthropic"` with OpenCode demo values.
- `scripts/seed-traces.ts:77–78` — same replacement.

### Scripts and tooling

- `scripts/dev-all.ts` — drop `{name:"anthropic-chat"}` and `{name:"claude-agent-sdk"}` entries (L270, L273) and delete the entire `pruneWrongClaudeAgentSdkLibcVariant()` function + its call site (L106–153, L397).
- `examples/README.md` — drop the two table rows (L47, L49).

### Dependencies removed from `package.json`

- **DELETE** L43 `"@ai-sdk/anthropic": "^3.0.69"` — verified zero importers in `src/`, `scripts/`, `bin/`.
- **DELETE** L47 `"@raindrop-ai/claude-agent-sdk": "^0.0.10"` — verified zero importers (only 2 comment hits at `src/parse.ts:198` and `src/spans/adapters/claude-agent-sdk.ts:5`, both removed by this change).
- **DELETE** `bunfig.toml:27` entry `"@raindrop-ai/claude-agent-sdk"` from `minimumReleaseAgeExcludes`.
- **DELETE** comment-only stale references in: `src/index.ts` (L27, L107, L732, L807), `src/parse.ts` (L198), `src/spans/adapters/types.ts` (L38), `src/spans/adapters/ai-sdk.ts` (L9, L14), `src/spans/normalized.ts` (L5), `src/db.ts` (L160), `src/agents.ts` (L66), `scripts/install-local.ts` (L218).

### Dependencies explicitly KEPT (Scope OUT confirmation)

- `@ai-sdk/openai` — OpenCode's OpenAI-compatible provider path (PLAN.md F-002 "kept" list).
- `agent-install@^0.0.5` — shared install-wizard dep, not Codex-specific.
- `@clack/prompts`, `raindrop-ai@^0.0.89`, all other unrelated deps.

## Capabilities

### New Capabilities

- `codex-claude-surface-removal`: Removes Codex CLI, Claude Code CLI, Claude Agent SDK, and Anthropic-API integration surfaces from the daemon, the install wizard's approved-agent list, the secret store, provider options, span normalization, annotation sources, demo/seed traces, scripts, examples, and dependencies. Codifies the OpenCode-only fork convention at the spec level.

### Modified Capabilities

_None._ F-001 introduced `cloud-surface-removal`, `auth-surface-removal`, `f001-plan-closeout`; none of those requirements change here.

## Impact

### Code surface

- **Deleted**: 6 source files (~1605 LOC) + 2 example directories (~4000–5000 LOC counting lock files).
- **Modified**: ~20 source/script/config files (see "What Changes").
- **Net reduction**: ~1800–2000 LOC of source plus the example directories.

### APIs

- 6 `/api/claude/*` routes removed, 1 `/api/models/anthropic` route removed, multiple internal branches in `/api/sessions`, `/api/sessions/:id`, `/api/agent/chat`, `/api/agent/run-once`, `/api/providers/status` collapse to OpenCode-only.
- WebSocket broadcasts `claude_loadout`, `claude_ask_user_question`, `claude_message_stream`, `agent_loadout` removed from `src/server.ts`.

### Database

- One new Drizzle migration under `drizzle/NNNN_*.sql` generated by `bun run db:generate` after `src/db/schema.ts:134` enum change. Existing annotation rows with `source IN ('claude-code','codex')` migrated to `'user'`.

### Dependencies

- `package.json` loses 2 entries; `bunfig.toml` loses 1 entry; `bun.lock` regenerated by `bun install`.

### Risk hotspots

1. **`src/server.ts` (2387 LOC, 65 match lines)** — largest blast radius. Mitigated by per-route commit decomposition (see tasks.md).
2. **`src/db/schema.ts:134` enum change** — migration must run cleanly; pre-existing annotation rows need to be mapped before the column constraint is enforced. Mitigated by writing the migration before editing the schema, and verifying on a dev DB.
3. **`src/agent-chat.ts` provider type collapse** — `~/.raindrop/agent-provider.json` on dev machines may carry stale `{"provider":"claude"}` values. Mitigated by tolerant read (`parseAgentProvider` returns `null` → defaults to `"opencode"`).

### Scope OUT (HARD — must not touch)

- `src/spans/adapters/ai-sdk.ts` — generic AI SDK adapter (KEEP).
- `src/spans/adapters/livekit.ts` — separate framework (KEEP).
- `src/agents.ts` — generic sub-agent detection (KEEP; only the L66 comment is touched).
- `examples/ai-sdk-chat/`, `examples/openai-chat/`, `examples/pi-agent-chat/`, `examples/ai-sdk-otelv2/`, `examples/opencode-plugin-chat/` — generic or unrelated (KEEP).
- `src/install/*` (except `detect.ts`) — shared install wizard (KEEP).
- `agent-install@^0.0.5` dep — shared with OpenCode install path (KEEP).
- `@ai-sdk/openai` dep — OpenCode's OpenAI-compatible path (KEEP).
- Top-level `AGENTS.md`, top-level `README.md`, `ai-docs/AGENTS.md` upstream sections, `Docs/` — upstream-owned (NEVER edit).
- F-003 (`add-subagent-visualization-f003`), F-004 (`improve-spans-ui-phoenix-style-f004`), F-005 (`add-html-session-export-f005`) — separate changes.
- `.claude/` lint ignore in `eslint.config.mjs:39` — covers user's local config dir, NOT Claude Code (KEEP).
- `examples/ai-sdk-chat/server.ts` Anthropic branch — generic multi-provider demo (KEEP).
- `examples/opencode-plugin-chat/server.ts:216` — informational `ANTHROPIC_API_KEY` mention in env-var list (KEEP).

### UI collapse (added per Kolya's directive during implementation)

Following the user's explicit instruction "удали claude-code, codex они не нужны. мы делаем форк который глубоко заточен под opencode", the Workshop UI surface was also collapsed to OpenCode-only as part of F-002. This is a "первый шаг" UI patch — the backend changes already collapse the provider shape, and the UI must match.

- `app/src/utils/agent-provider.ts` — `AgentProviderId = "claude" | "codex"` → `"opencode"` (single literal). `providerLabel()` returns `"OpenCode"`. `isAgentProvider(value) === "opencode"`.
- `app/src/components/MessagePane.tsx` — `FloatingAskButton`, `ProviderMark`, `SmallProviderIcon`, `LargeProviderIcon`, `ProviderDropdown`, `ProviderThinking`, `AgentConnectCard`, `resumeCommandForSession` all collapsed to OpenCode-only paths. `claudeCodeLogo` and `codexLogo` imports removed. TODO marker placed where the eventual `app/src/assets/opencode-logo.svg` should be wired.
- `app/src/api/agents.ts` — default provider `"opencode"`; backend `claude_code` field preserved as a graceful-degradation fallback while the backend migration is still in flight.
- `app/src/hooks/use-agent-provider.ts` — default provider `"opencode"`.
- `app/src/components/ConnectionIndicator.tsx` — provider default `"opencode"`, MCP-add command flipped to `opencode mcp add`, remediation copy collapsed to OpenCode CLI.

Files NOT touched (per Kolya's directive):
- `app/src/assets/claude-code-logo.png`, `app/src/assets/codex-logo.svg` — preserved on disk; deletion deferred to a follow-up.
- `app/src/components/EmptyState.tsx` — AGENTS array (Cursor / Claude Code / Codex / Windsurf / Gemini CLI / Cline) is hard-coded marketing copy, not driven by `AgentProviderId`. Out of scope.
- `app/src/utils/helpers.ts` — claude/anthropic substring detection belongs to a different domain (CLI binary detection, not the agent-chat surface).

The UI patch is staged in the working tree as `M` against `main`. It is **not** part of any of the 7 backend commits; it ships as a separate commit (or remains uncommitted per Kolya's directive "не делай git commit, не делай git push").

### Verification path (per `ai-docs/AGENTS.md`)

- `bun x tsc --noEmit` — type safety across all modified files.
- `bun run lint` — ESLint passes on changed files.
- `bun run test` — existing tests still pass (no test fixtures should reference deleted code).
- `bun run db:generate` — produces exactly one new migration with the expected enum narrow.
- `bun run dev` — daemon boots, `curl localhost:5899/api/providers/status` returns OpenCode-only shape, `/api/claude/*` returns 404, `/api/models/anthropic` returns 404.
- Final grep sweep: `grep -rni "codex\\|claude\\|anthropic" src/ scripts/ examples/ bin/ package.json bunfig.toml` returns only the explicitly-kept occurrences listed in "Scope OUT".

### Plan reference

Implements `ai-docs/PLAN.md` F-002 (lines 146–176).
