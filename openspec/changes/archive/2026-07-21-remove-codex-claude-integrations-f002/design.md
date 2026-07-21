## Context

The fork (see `ai-docs/AGENTS.md` and `ai-docs/HANDOFF.md`) commits to two hard constraints: **local-only** (no cloud) and **OpenCode-only** (no Codex CLI, Claude Code CLI, Claude Agent SDK, or Anthropic-API). F-001 removed the cloud/auth surface. F-002 removes the Codex/Claude/Anthropic surface.

Today the codebase still carries ~1605 LOC of dedicated Codex/Claude source plus ~4000–5000 LOC of related example apps, plus another ~20 mixed-purpose files with Codex/Claude/Anthropic branches. The largest blast radius is `src/server.ts` (65 match lines). The deepest coupling is `src/agent-chat.ts` (`AgentProviderId = "claude" | "codex"`) — every consumer of the agent chat API inherits that type. The most fragile change is `src/db/schema.ts:134` where the annotation `source` enum is a Drizzle-managed SQLite constraint.

This design covers: (a) commit decomposition to keep blast radius manageable per the fork's one-commit-per-Feature-step rule, (b) the migration strategy for the enum narrow, (c) the dependency-removal order, (d) decision points that affect later F-003..F-005 work.

## Goals / Non-Goals

**Goals:**

- Remove every behavior surface that distinguishes Codex CLI, Claude Code CLI, Claude Agent SDK, or Anthropic API from the OpenCode path.
- Collapse the agent-provider model to a single value `"opencode"` with clean types and no legacy fallbacks that future contributors must reason about.
- Remove two npm dependencies that have no remaining importers.
- Produce a Drizzle migration that preserves existing annotation rows.
- Decompose the change into 6–8 commits, each independently reviewable and revertable, following F-001's pattern (5 commits, one per logical step).
- Verify with `bun x tsc --noEmit`, `bun run lint`, `bun run test`, `bun run db:generate`, and a final grep sweep returning only the explicitly-kept occurrences listed in the proposal's "Scope OUT".

**Non-Goals:**

- Refactoring the OpenCode agent-chat path while collapsing the type. The OpenCode branch must behave identically before and after F-002.
- Adding new annotation sources, new providers, or new routes.
- Renaming or repurposing the `provider` column on `spans` — the column stays; only the runtime value set narrows in practice.
- Touching the generic AI SDK adapter (`src/spans/adapters/ai-sdk.ts`) or the LiveKit adapter — those remain canonical normalizers for any future generic-AI-SDK consumer.
- Touching the upstream-owned files at repo root (`AGENTS.md`, `README.md`, `Docs/`).
- Implementing F-003, F-004, or F-005.

## Decisions

### D1 — Commit decomposition (load-bearing)

Split F-002 into **7 commits**, each focused on one blast radius. Order chosen so every intermediate commit compiles and passes the test suite:

1. `feat(F-002): remove codex-cli-chat and codex-sessions modules` — delete `src/codex-cli-chat.ts`, `src/codex-sessions.ts`, drop their imports from `src/server.ts` (one provider branch in `/api/sessions`, `/api/sessions/:id`, `/api/agent/chat`, `/api/agent/run-once`), drop the codex slash-command and capability branches in `src/agent-chat.ts`.
2. `feat(F-002): remove claude-cli-chat, claude-sessions, claude-ask-user-question` — delete the three Claude-only modules, drop their imports and route handlers from `src/server.ts` (the six `/api/claude/*` routes and `/api/claude/messages`), drop the WebSocket broadcasts `claude_loadout`, `claude_ask_user_question`, `claude_message_stream`, `agent_loadout`.
3. `feat(F-002): remove claude-agent-sdk span adapter` — delete `src/spans/adapters/claude-agent-sdk.ts`, drop its registration in `src/spans/normalize.ts:28,36`, and clean the stale comments in `src/parse.ts:198`, `src/spans/adapters/types.ts:38`, `src/spans/adapters/ai-sdk.ts:9,14`, `src/spans/normalized.ts:5`, `src/db.ts:160`, `src/agents.ts:66`.
4. `feat(F-002): remove codex/claude/anthropic example apps` — delete `examples/claude-agent-sdk/` and `examples/anthropic-chat/` directories; drop their entries in `scripts/dev-all.ts:270,273`; delete the `pruneWrongClaudeAgentSdkLibcVariant()` function (L106–153) and its call site (L397); drop the two table rows in `examples/README.md:47,49`.
5. `feat(F-002): collapse agent provider model to OpenCode-only` — rewrite `src/agent-chat.ts` so `AgentProviderId = "opencode"`; drop `parseAgentProvider`, `agentAnnotationSource`, slash-command and capability branches; narrow `src/annotations.ts:29` `SOURCES` set; narrow `src/mcp/tools.ts:189` enum check; narrow `src/install/detect.ts:20,22` `APPROVED_AGENTS`; drop the `anthropic` entry in `src/secret-store.ts:8–11`; drop the `anthropic()` branch and Anthropic defaults in `src/provider-options.ts`; drop the `/api/models/anthropic` route and the Anthropic path in `/api/agent/run-once` from `src/server.ts`; drop the Anthropic mention from `src/index.ts` help text comments (L27, L107, L732, L807).
6. `feat(F-002): narrow annotation source enum and migrate legacy rows` — write the new Drizzle migration that maps existing `source IN ('claude-code','codex')` rows to `'user'` BEFORE adding the column constraint; modify `src/db/schema.ts:134` enum to `["user","opencode"]`; update `scripts/seed-traces.ts:77,78` and `src/demo-traces.ts` to use OpenCode demo provider/model values.
7. `chore(F-002): drop @ai-sdk/anthropic and @raindrop-ai/claude-agent-sdk deps` — edit `package.json` (remove L43, L47), edit `bunfig.toml` (remove L27), run `bun install` to regenerate `bun.lock`, run final grep sweep.

**Rationale:** F-001 used 5 commits for a smaller surface (cloud/auth). F-002 has 65 match lines in `src/server.ts` alone, so 7 commits give each reviewer a focused diff. Order ensures no commit breaks compilation: by commit 5 the type collapse is the only risky step, and it depends on commits 1–4 having removed every consumer of the legacy branches.

**Alternatives considered:**

- Single mega-commit — rejected; review burden too high, revert granularity lost.
- 10+ commits split by file — rejected; reviewers lose the logical narrative; the 7-way split maps to the proposal's section headers.
- Type collapse before route deletion — rejected; would leave dead code paths that fail typecheck.

### D2 — Annotation `source` enum migration (load-bearing)

**Decision:** Write the migration as a two-step SQL inside a single Drizzle migration file:

```sql
-- step 1: migrate legacy values BEFORE the constraint narrows
UPDATE annotations SET source = 'user' WHERE source IN ('claude-code', 'codex');
-- step 2: narrow the column check constraint
-- (Drizzle emits the new CHECK clause automatically from the schema.ts edit)
```

Drizzle does not auto-rewrite data, so step 1 must be hand-written in the generated `drizzle/NNNN_*.sql` file after `bun run db:generate`. The migration is reversible: the down-migration is a no-op (we keep the old enum members documented but not enforced).

**Rationale:** F-001 did not touch this enum. The fork's local-only guarantee means every annotation row was authored by the user (or by an agent acting on the user's behalf), so collapsing `claude-code` and `codex` onto `'user'` preserves intent. `'opencode'` is reserved for future explicit-agent annotations emitted by F-003's plugin work.

**Alternatives considered:**

- Keep the enum permissive (`['user','claude-code','codex','opencode']`) — rejected; leaves dead branches in `src/mcp/tools.ts:189` and confuses contributors.
- Drop the enum entirely (free-text `source`) — rejected; future F-003 sub-agent work benefits from a constrained set.
- Add a `'legacy'` value for old rows — rejected; semantic loss. `'user'` is the truthful label.

### D3 — Dependency removal order (load-bearing)

`@ai-sdk/anthropic` and `@raindrop-ai/claude-agent-sdk` have **zero** importers in `src/`, `scripts/`, `bin/` (verified by audit). Removing them is purely a `package.json` + `bunfig.toml` + `bun.lock` change. Doing this in commit 7 (the final commit) ensures that if any consumer was missed in earlier commits, the build fails loudly at the dep-removal step rather than producing a transient broken intermediate state.

`agent-install` is KEPT — it is shared with the OpenCode install path. The strings `"claude-code"` and `"codex"` in `src/install/detect.ts:20,22` are display-only identifiers; the runtime detection is owned by `agent-install` itself. Removing the strings is safe because the install wizard no longer offers those options to the user (F-002's commit 5).

**Alternatives considered:**

- Remove deps in commit 1 — rejected; if any consumer was missed, every subsequent commit fails to build.
- Keep `@raindrop-ai/claude-agent-sdk` for the span adapter — rejected; the adapter file is deleted in commit 3, leaving the dep unused.

### D4 — Provider-options collapse (reversible)

`src/provider-options.ts` currently has an `anthropic()` provider branch and Anthropic-shaped defaults in `detectProvider`/`getProviderBaseURL`/`getProviderHeaders`. F-002 deletes the `anthropic()` branch and changes the defaults to OpenAI shape (which is what the OpenCode path uses today via `@ai-sdk/openai`). The module still accepts arbitrary `providerOptions` for forward compatibility with future generic AI SDK consumers — only the Anthropic-specific shape and defaults are dropped.

**Rationale:** OpenCode uses `@ai-sdk/openai` against OpenAI-compatible endpoints; the Anthropic branch is dead code in the fork. Keeping the generic `providerOptions` plumbing preserves the file's purpose without the legacy provider.

### D5 — `~/.raindrop/agent-provider.json` stale values (reversible)

After commit 5 collapses `AgentProviderId` to `"opencode"`, dev machines may have a stale `~/.raindrop/agent-provider.json` containing `{"provider":"claude"}` or `{"provider":"codex"}`. The collapse commit must make the read path **tolerant**: `parseAgentProvider` returns `null` for unknown values, and the caller defaults to `"opencode"`. The write path overwrites the stale value on the next call.

**Rationale:** Silent overwrite is safer than a startup error. The file is dev-machine-local; no migration is needed.

## Risks / Trade-offs

- **[Risk] `src/server.ts` surgery introduces a runtime regression in `/api/sessions`, `/api/agent/chat`, or `/api/providers/status`.** → Mitigation: commit-by-commit verification with `curl localhost:5899/api/providers/status` after each commit; e2e tests in `app/tests-e2e/workshop-actions.spec.ts` run before final commit.
- **[Risk] Drizzle migration fails on dev DBs with legacy annotation rows.** → Mitigation: write the `UPDATE annotations SET source='user' WHERE source IN ('claude-code','codex')` step BEFORE the constraint-narrowing step; verify on a dev DB with seeded legacy rows.
- **[Risk] Comment-only stale references (e.g. `src/parse.ts:198`) survive the change.** → Mitigation: commit 3 includes a scripted sweep of the 9 documented comment sites; the final commit 7 runs the full grep sweep and fails if anything but the "Scope OUT" allowlist remains.
- **[Risk] `agent-install` package silently re-introduces Codex/Claude agent IDs into the install wizard.** → Mitigation: F-002 commit 5 narrows `src/install/detect.ts:APPROVED_AGENTS`; the runtime detection in `agent-install` is independent and may still recognize Codex/Claude binaries on disk, but the wizard no longer offers them as install targets.
- **[Risk] Demo/seed traces regress to claude/anthropic strings if copy-pasted from upstream later.** → Mitigation: commit 6 changes `src/demo-traces.ts` and `scripts/seed-traces.ts` to OpenCode values; the final grep sweep includes these files.
- **[Trade-off] Net LOC reduction (~1800–2000) makes future upstream merges harder.** → Accepted: the fork's stated direction is divergence, not merge-tracking. The proposal's "Scope OUT" section documents what is intentionally preserved for future upstream alignment.
- **[Trade-off] 7 commits is more than F-001's 5.** → Accepted: the surface is larger (65 server.ts matches vs F-001's smaller auth/cloud surface), and per-step revertability is worth the extra review passes.

## Migration Plan

1. Apply commits 1–7 in order. Each commit must pass `bun x tsc --noEmit`, `bun run lint`, and `bun run test` independently.
2. After commit 6, run `bun run db:generate` to emit the new migration file. Manually edit the generated SQL to insert the `UPDATE annotations SET source='user' WHERE source IN ('claude-code','codex')` statement BEFORE the constraint-narrowing statement. Run `bun run db:migrate` on a dev DB seeded with legacy annotation rows to verify the migration is idempotent and lossless.
3. After commit 7, run the final grep sweep:
   ```
   grep -rni "codex\|claude\|anthropic" src/ scripts/ examples/ bin/ package.json bunfig.toml
   ```
   Acceptable matches are exactly the entries listed in the proposal's "Scope OUT" section.
4. **Rollback strategy:** revert commits in reverse order (7 → 1). The Drizzle migration has no down-migration (the column narrows; legacy values are preserved as `'user'`).

## Open Questions

- Should `src/install/detect.ts:APPROVED_AGENTS` keep `"claude-code"` and `"codex"` strings for the install wizard's detection phase (recognize but don't offer)? The audit says no (the strings are display-only). **Default:** drop the strings in commit 5.
- Should the final grep sweep be added as a CI step (a pre-commit hook or a `bun run check:no-codex-claude` script)? Out of scope for F-002; candidate for a follow-up change. **Default:** document in `ai-docs/AGENTS.md` after F-002 lands.
