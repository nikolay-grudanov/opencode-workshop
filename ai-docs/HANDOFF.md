# HANDOFF snapshot — opencode-workshop fork, started 2026-07-10

> **For:** Kolya + next-session Miko.
> **Read alongside:** [`PLAN.md`](PLAN.md) (active features + todos) and [`AGENTS.md`](AGENTS.md) (conventions).
> **Mirror in Hindsight:** `mcp_hindsight_recall(query="handoff opencode-workshop 2026-07-10", budget="mid")` — backup.

## Current state (where we are)

- **Repo (live on GitHub):** https://github.com/nikolay-grudanov/opencode-workshop
- **Branch:** main
- **HEAD:** `914d74d` (release v0.1.15, last upstream commit we pulled 2026-07-09)
- **Local clone:** `/home/gna/workspase/projects/opencode-workshop/` (moved from `/home/gna/project/opencode-workshop/` 2026-07-10 — same reasoning as the plugin fork: `/tmp` is volatile, `~/project/` is the wrong prefix)
- **Upstream remote:** `https://github.com/raindrop-ai/workshop.git`
- **Latest tag:** v0.1.15
- **Plugin companion:** `~/workspase/projects/opencode-workshop-plugin/` (`@grudanov-nikolay/opencode-workshop-plugin@0.1.0-kolya.6`, separate fork at `nikolay-grudanov/opencode-workshop-plugin`)

## Scope of this fork (per Kolya's request 2026-07-10)

1. **Remove all Cloud Raindrop** — SaaS app, paid plans, OAuth, write-keys, cloud-MCP, API at `app.raindrop.ai`. Local daemon only.
2. **Remove Codex + Claude Code integrations** — replace with OpenCode-only equivalents. Kolya doesn't use these.
3. **Visualize OpenCode sub-agents** — `task` tool invocations should appear as named sub-agent cards in Workshop UI, with their conversation tree visible.
4. **Phoenix-like spans UI** — proper OTel GenAI span tree, per-span latency bars, OTel JSON export option.
5. **Self-contained HTML session export** — port `hermes-webui/api/session_export_html.py` (prototype) into Workshop. Standalone HTML, embedded CSS, no CDN, no remote images (signed-URL leak prevention).

## What an agent should know upfront

### Codebase facts (from 2026-07-10 reconnaissance)

| Area | Status |
|---|---|
| `src/cloud/` (11 files) | To remove — all SaaS code |
| `src/auth/` (4 files) | Probably to remove — OAuth + write-key storage |
| `src/codex-cli-chat.ts`, `src/codex-sessions.ts`, `src/claude-cli-chat.ts` | To remove |
| `src/spans/adapters/claude-agent-sdk.ts` | To remove |
| `src/spans/adapters/ai-sdk.ts`, `src/spans/adapters/livekit.ts`, `src/spans/adapters/types.ts` | **Keep** — generic |
| `src/spans/normalize.ts`, `src/parse.ts`, `src/otlp-protobuf.ts` | **Keep** — already OTel-aware |
| `src/agents.ts` (130 LOC) | **Already has sub-agent detection** (TOOL_CALL > LLM_GENERATION > TOOL_CALL pattern). Need to extend for `task` tool naming. |
| `app/src/components/SpanTree.tsx`, `ChatFlow.tsx`, `MessagePane.tsx`, `RunDetail.tsx`, `SearchPage.tsx`, `SavedPage.tsx` | **Keep** — all already display sub-agents and spans |
| `install.sh` | Has `raindrop cloud setup` step — needs cleanup |
| `package.json` deps | `@raindrop-ai/ai-sdk ^0.0.24`, `@raindrop-ai/claude-agent-sdk ^0.0.10` (drop), `raindrop-ai ^0.0.89` (keep for daemon parts), `@ai-sdk/anthropic ^3.0.69` (drop in F-002), `@ai-sdk/openai ^3.0.26` (keep — OpenCode uses OpenAI-compatible providers) |
| `examples/{claude-agent-sdk,anthropic-chat}/` | To remove (F-002) |
| `examples/{ai-sdk-chat}/` | Keep — generic |

### Existing F-005 prototype (THE input we should port)

`/home/gna/hermes-webui/api/session_export_html.py` — 297 LOC. Pure functions, no hermes-webui-specific deps except `markdown_it`. Test at `tests/test_session_export_html_palette.py` (270 LOC).

**Key security pattern to reuse:** `_neutralize_remote_images()` — strips `<img src="https://...">` post-markdown-rendering, keeps only `data:` URIs. This prevents signed/private URL leaks when opening the saved HTML offline.

### Upstream AGENTS.md (do not edit without explicit ask)

Already at repo root. Tells the user-or-developer fork story (use `raindrop workshop start` vs `bun run dev`). Doesn't reference our kolya-fork work at all.

## Locked-in decisions (from Kolya + memory)

- **No Cloud, no Codex, no Claude.** Confirmed 2026-07-10 by Kolya.
- **Local Workshop daemon only.** Port 5899, runs as user (no PM2/tmux needed for now — `bun run dev` is fine).
- **OpenCode plugin fork** (`@grudanov-nikolay/opencode-workshop-plugin@0.1.0-kolya.6`) is the producer of traces. Don't break its contract.
- **No auto-commit/push.** Kolya must explicitly say "push" before any `git push`.
- **No self-restart** of Workshop daemon or OpenCode without explicit OK.
- **Best is enemy of good enough** — Kolya prefers small focused PRs (5-7 commits for F-001) over mega-PRs. Reference `kolya-dashboard` and plugin-fork multi-commit pattern.
- **HTML export must be self-contained** — no CDN, no external assets, no remote images (signed URL leak prevention).
- **`HERMES-WEBUI` `session_export_html.py` is the reference implementation, not the source** — port the logic, don't import (hermes-webui may not be in workshop's deps, and even if it is, we want to own the code).

## Miko's locked-in rules (DO NOT VIOLATE)

- **NO SELF-RESTART** — even if the daemon looks broken, ask Kolya before restarting.
- **NO delete-confirmation** — `npm install / rm / git reset` etc. all require explicit "ok", "go", "delete".
- **Don't speculate about root causes** — verify with status endpoints / curl before writing memory.
- **Worker honesty** — multi-agent workers (Hermes, Claude Code, Spec-Kit, opencode subagents) historically lie about task completion; always verify branches, commits, and merges yourself.

## What I have NOT done yet (still pending)

- ❌ **F-001** (remove cloud) — planned but not started. Will need ~5 commits per Kolya's preferred pattern (rm → fix imports → verify).
- ❌ **F-002** (remove Codex/Claude) — planned but not started.
- ❌ **F-003** (sub-agent UI for `task` tool) — partial UI exists, need plugin-side metadata patch + UI extension.
- ❌ **F-004** (Phoenix-like spans) — mostly already in place, polish-only.
- ❌ **F-005** (HTML export) — port from `hermes-webui`, partial plan.
- ❌ **No commits yet** for this repo in this session — waiting for Kolya's "go" on F-001.

## Cross-session anchor for Hindsight

If you're a new session, run:
```
mcp_hindsight_recall(query="handoff opencode-workshop 2026-07-10 Kolya fork plan", budget="mid")
```

This should surface both this HANDOFF.md context and the earlier plugin-fork handoff (`handoff opencode-workshop-plugin 2026-07-09`).

---

*Maintained by Miko (Hermes Agent). Created 2026-07-10 00:30 MSK.*
