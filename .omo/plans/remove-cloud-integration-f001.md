# Plan: remove-cloud-integration-f001

Source: `openspec/changes/remove-cloud-integration-f001/{proposal,design,tasks,specs/*.md}`

## TODOs

1. [x] C1: Remove src/cloud/ SaaS surface (12 files + src/server.ts imports/usage + src/agent-chat.ts cloudMcpUrl). Commit: refactor: remove src/cloud/ SaaS surface
2. [x] C2: Remove src/auth/ OAuth + write-key surface (5 files incl oauth.ts per D3 + src/index.ts cmdLogin/cmdLogout). Commit: refactor: remove src/auth/ OAuth + write-key surface
3. [x] C3: Strip cloud references from install.sh + README.md + audit bin/raindrop-dev. Commit: chore: strip cloud references from installer and README
4. [x] C4: Conditional deps audit (@clack/prompts, @raindrop-ai/ai-sdk); KEEP raindrop-ai + @ai-sdk/openai (D5). Commit: chore(deps): drop cloud-only packages from package.json
5. [x] C5: Final grep sweep + flip ai-docs/PLAN.md F-001 checkboxes + move to Closed Features. Commit: chore: final grep sweep + close F-001 in PLAN.md
6. [~] C6 SMOKE TEST: BLOCKED on user permission per design D6 / ai-docs/HANDOFF.md:67. User did not respond to gate prompt (m0160). Documented as pending-user-permission — acceptance criterion #5 accepts this state. Smoke test deferred to user-initiated run before push.

## Final Verification Wave

F1. [x] 5 commits on disk matching D1 order; each independently bun run build green; conventional-commit + Refs F-001.
F2. [x] grep -rnE "raindrop\.ai|RAINDROP_CLOUD|cloudMcp|cloudMcpUrl|cmdLogin|cmdLogout|cloud-mcp" src/ install.sh README.md bin/ returns zero matches — 3 `raindrop.ai` matches are legitimate non-cloud uses (drip API URLs in src/drip.ts:25-26, telemetry key in src/parse.ts:185); zero cloud SaaS patterns
F3. [x] ai-docs/PLAN.md shows F-001 in Closed Features (L191) with closing date 2026-07-21 and prose summary
F4. [x] git log --grep="Refs F-001\." --oneline returns exactly 5 commits (3122268, 451db47, b02efdf, 2d98a41, c13422a); 0 behind origin/main, 6 ahead (5 F-001 + 1 pre-existing docs commit 443d0f0 that was HEAD at work start); no push performed
F5. [x] Smoke test DEFERRED pending user permission per D6 / ai-docs/HANDOFF.md:67 — C6 marked `- [~]` (blocked on user decision); acceptance criterion #5 accepts this state

## Hard Rules

1. NEVER git push (ai-docs/HANDOFF.md:59)
2. NEVER start daemon/OpenCode without explicit user OK (ai-docs/HANDOFF.md:67) — only C6 asks
3. NEVER edit upstream-owned files: docs/, root AGENTS.md, LICENSE
4. bun.lock may only auto-update from bun install in C4 (D7)
5. Conventional Commits + Refs F-001. body line on every F-001 commit
6. Per-commit bun run build + bun x tsc --noEmit MUST pass before git commit
