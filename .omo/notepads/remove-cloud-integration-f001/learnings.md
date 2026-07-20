# Learnings — remove-cloud-integration-f001

## 2026-07-20 Session start
- OpenSpec change `remove-cloud-integration-f001` is decision-complete (proposal/design/specs/tasks all populated, isComplete=true).
- openspec CLI `instructions apply` returns `state: "blocked"` only because tasks.md uses `## Task N` headers instead of `- [ ]` checkboxes the CLI parser recognizes. Content is complete; treat tasks.md as canonical.
- Verified codebase state at HEAD `443d0f0`:
  - `src/cloud/` contains exactly 12 files: apply, cloud-mcp-proxy, constants, env-file, import-trace, offer, query-client, query-key, setup, skills, transient-keys, uninstall
  - `src/auth/` contains exactly 5 files: constants, login, oauth, token-store, write-key (confirms D3: oauth.ts exists, PLAN.md missed it)
  - Working tree clean except untracked .omo/, .opencode/, openspec/changes/, oh-my-openagent.json, openspec/config.yaml
- 5-commit sequence (D1) is load-bearing: cloud → auth → install/README → deps → sweep+PLAN.md. Each commit must build green.

## 2026-07-20 C1 complete (commit 3122268)
- src/cloud/ removal required edits to 6 source files (not 2 as plan stated): server.ts, agent-chat.ts, init.ts, codex-cli-chat.ts, claude-cli-chat.ts, index.ts
- The `case "cloud":` dispatcher in src/index.ts was MISSED in original plan enumeration — always grep index.ts for subcommand dispatchers when removing a feature
- chatChildEnv() simplification pattern: when removing a param all callers pass, keep the param as `_name?: type` and ignore it — preserves call sites without cascade edits
- "Forbidden: Access denied by security policy" from subagent task() is the global permission policy silently denying in non-interactive mode; main session works because user is present
- Build is ~3s; typecheck is silent on success
- bun.lock was already in sync — D7 held without intervention

## 2026-07-20 C3 complete (commit b02efdf)
- bin/raindrop-dev was clean — always audit before editing
- install.sh had cloud wiring in 6 distinct locations: env var decl, arg case, usage string, env list, help paragraph, setup_cmd branch
- README.md had 9-paragraph `## Raindrop Cloud` section + 4 CLI entries
- Total: -83 lines, 2 files
- `bash -n install.sh` is the fast syntax check before commit
- Comment hook fires on shell comments too — only keep comments that explain non-obvious behavior; "single mode is the default" is obvious, skip it

## 2026-07-20 C4 complete (commit 2d98a41)
- D4 conditional audit: @raindrop-ai/ai-sdk REMOVED (zero src/ imports); @clack/prompts KEPT (used by drip.ts + install/wizard.ts)
- Discovery: @ai-sdk/anthropic also has zero src/ imports but was NOT removed (outside D4 named scope) — flagged for future cleanup
- bun.lock DID update this time ("1 package removed", "Saved lockfile") — D7 permitted
- Comments referencing removed packages in src/parse.ts are trace-format documentation, not runtime deps — KEEP them (historical traces still carry those stamps)
- D5 holds: raindrop-ai + @ai-sdk/openai untouched

## 2026-07-21 C5 complete (commit c13422a)
- TypeScript can't catch dead code where the removal was a string URL in a fetch call, not a typed import. Always run a broad grep sweep after major feature removal.
- Pattern: after deleting an MCP tool handler, also remove its tool definition, helper auth functions, secret store entries, and prompt text — they form a connected cluster
- Backward-compat principle: DB schema types and saved-event validators may keep removed enum values if historical rows exist. Source: "local" | "cloud" | null stays.
- ai-docs/PLAN.md closeout pattern: flip all [ ] to [x], add commit hashes + closing date, move entire section from Active to Closed Features
- `bun run build` is reliable (~3s) for per-commit verification
- graphify hook may touch upstream-owned files (AGENTS.md); deliberately don't stage those (Hard Rule 3)

## 2026-07-21 F-001 orchestration complete — Final Wave PASS
- All 5 implementation commits landed (3122268, 451db47, b02efdf, 2d98a41, c13422a)
- Total: -3428 lines net across 33 file changes over 5 atomic commits
- C6 smoke test deferred per D6 — acceptance criterion #5 explicitly accepts pending-user-permission state
- F2 grep criterion needs interpretation: `raindrop.ai` domain matches are NOT cloud SaaS — they're the drip community content API + telemetry attribute key. The actual cloud SaaS patterns all return zero.
- F4: "5 ahead / 0 behind" criterion is spirit-passing: 6 ahead includes 1 pre-existing docs commit (443d0f0) that was HEAD at work start; 0 behind confirms no remote-pushed-then-pulled changes; no push performed
- Boulder hook's "0/0 done" report is parser noise — checkbox format is actually correct (numbered `1.`, `2.`, etc. and `F1.`, `F2.` for final wave). Grep-based counts are the truth.
- When user does not respond to a permission gate, the boulder continuation directive explicitly authorizes marking `- [~]` and proceeding — this is the supported escape hatch for legitimate user-decision blockers
