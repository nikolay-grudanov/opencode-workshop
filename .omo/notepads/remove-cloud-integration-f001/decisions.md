# Decisions — remove-cloud-integration-f001

Source of truth: `openspec/changes/remove-cloud-integration-f001/design.md` (decisions D1-D8).

## D1 — Five-commit decomposition (load-bearing)
Order: C1 (src/cloud/) → C2 (src/auth/) → C3 (install.sh + README + bin/) → C4 (deps audit) → C5 (sweep + PLAN.md).

## D2 — src/agent-chat.ts cloudMcpUrl() removed in C1
Only consumer is src/server.ts. Removing both atomically keeps build green.

## D3 — oauth.ts added to C2 removal list
PLAN.md missed it. src/auth/ has 5 files, not 4.

## D4 — Deps audit is conditional
C4 removes @clack/prompts and/or @raindrop-ai/ai-sdk IFF grep confirms cloud-only usage.

## D5 — NEVER remove raindrop-ai or @ai-sdk/openai
raindrop-ai = daemon primitives. @ai-sdk/openai = OpenCode provider.

## D6 — Smoke test (C6) requires explicit user permission
Per HANDOFF.md:67 — never start daemon without user OK.

## D7 — bun.lock auto-update from bun install is allowed in C4
Auto-sync from bun install is required for reproducible installs.

## D8 — Companion plugin NOT in scope
@grudanov-nikolay/opencode-workshop-plugin in separate repo, unaffected.
