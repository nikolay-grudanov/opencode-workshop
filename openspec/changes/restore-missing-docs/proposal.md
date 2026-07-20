## Why

This fork has rich process docs (`ai-docs/PLAN.md`, `HANDOFF.md`, `AGENTS.md`) but **zero technical reference docs** — no module map, no API surface catalog, no plugin contract, no DB schema reference, no dev-environment guide. An agent or contributor picking up any Feature (F-001..F-005) has to reverse-engineer the codebase each time, which is exactly the friction that stalled the previous planning attempt (`ai-docs/HANDOFF.md:72-79` lists five F-NNN items still pending, with no commits).

The fork is now at the point where planned work (F-001 cloud removal, F-002 Codex/Claude removal, F-003..F-005 UI/UX work) requires an onboarding path that does not depend on session memory or reading 2550 LOC of `src/server.ts` to discover a single endpoint. This change closes that gap.

## What Changes

Create five technical reference documents under `ai-docs/` (the fork's doc space — `docs/` at repo root is upstream-owned and untouched):

- **`ai-docs/ARCHITECTURE.md`** — module map of `src/`, end-to-end data flow (OTLP ingest → normalize → SQLite → WS stream → React UI), and the upstream-vs-fork boundary.
- **`ai-docs/API.md`** — exhaustive HTTP + WebSocket surface: every `/api/*` route and WS event the daemon exposes (`runs`, `spans`, `annotations`, `saved-events`, `replay`, `live-events`), with request/response shapes.
- **`ai-docs/PLUGIN-CONTRACT.md`** — what the companion plugin `@grudanov-nikolay/opencode-workshop-plugin` must satisfy: OTLP ingest endpoint, span shape, `task` sub-agent metadata, env vars (`RAINDROP_LOCAL_DEBUGGER`).
- **`ai-docs/DATABASE.md`** — SQLite schema (Drizzle), tables (`runs`, `spans`, `annotations`, `saved_events`, `saved_folders`, `live_events`), migration workflow (`db:generate` / `db:embed` / `db:migrate`), DB path env var.
- **`ai-docs/DEVELOPMENT.md`** — dev environment deeper than upstream `AGENTS.md`: env vars, `dev` vs `dev:server` vs `dev:ui`, smoke-test procedure, build matrix, lint/test commands, the no-`tests/`-dir gap.
- **Update `ai-docs/AGENTS.md`** — extend the "Quick reference" table to link the five new docs (single-line additions, no other edits).

## Capabilities

### New Capabilities

- `architecture-doc`: A module-and-dataflow reference that lets any agent map `src/` to runtime responsibilities without reading source.
- `api-reference-doc`: A complete HTTP+WS API catalog with method, path, query params, request body, response shape, and example for every endpoint the daemon exposes.
- `plugin-contract-doc`: The interface contract between this daemon and `opencode-workshop-plugin` — endpoint, payload shape, env vars, sub-agent metadata expectations.
- `database-schema-doc`: The SQLite/Drizzle schema reference — every table, column, index, plus the migration workflow commands.
- `development-environment-doc`: The dev/onboarding reference — env vars, all `bun run *` scripts, smoke-test procedure, known gaps (no `tests/` dir).

### Modified Capabilities

_None._ No existing specs in `openspec/specs/` — this is a first-of-kind change. The fork's process docs (`PLAN.md`, `HANDOFF.md`, `AGENTS.md`) describe workflow but not behavior contracts.

## Impact

**Files added (5):**
- `ai-docs/ARCHITECTURE.md`
- `ai-docs/API.md`
- `ai-docs/PLUGIN-CONTRACT.md`
- `ai-docs/DATABASE.md`
- `ai-docs/DEVELOPMENT.md`

**Files modified (1, documentation only):**
- `ai-docs/AGENTS.md` — Quick-reference table gains five rows linking the new docs.

**Anchors to read while writing docs (citation surface, not edit surface):**
- Module map source: `src/index.ts`, `src/server.ts`, `src/db/schema.ts`, `src/spans/normalize.ts`, `src/agents.ts`, `src/replay.ts`, `src/parse.ts`, `src/otlp-protobuf.ts`.
- API surface source: `src/server.ts` (2550 LOC, route definitions).
- Plugin contract source: `src/parse.ts`, `src/otlp-protobuf.ts`, `src/spans/normalize.ts`, `ai-docs/HANDOFF.md:55-63`.
- DB schema source: `src/db/schema.ts`, `src/db/migration-assets.ts`, `drizzle.config.ts`, `package.json:28-31`.
- Dev environment source: `package.json:17-41`, `ai-docs/AGENTS.md:61-75`, `README.md:113-120`.

**Scope OUT (must NOT be touched by this change):**
- ❌ `docs/` directory (upstream-owned; `ai-docs/AGENTS.md:55-59`).
- ❌ Repo-root `AGENTS.md` (upstream-owned; `ai-docs/AGENTS.md:55-59`).
- ❌ `LICENSE`, `bun.lock` (upstream-owned).
- ❌ Any file under `src/`, `app/`, `bin/`, `scripts/`, `examples/`, `skills/` (code surface — separate changes).
- ❌ `ai-docs/PLAN.md` (would change F-NNN state; this change is doc-only).
- ❌ `ai-docs/HANDOFF.md` (process state; not in scope).
- ❌ Creating a `tests/` directory or writing tests (out of "restore documentation" scope — the missing-`tests/` gap is documented in DEVELOPMENT.md as a known issue for a future change).
- ❌ F-001, F-002, F-003, F-004, F-005 code work — separate changes.

**No runtime impact.** No code, deps, or config changes — the daemon build (`bun run dev`), test commands, and trace streaming are unaffected. Verification is structural (files exist, anchors cited, lint clean) not behavioral.

**Risk:** Low. Pure documentation addition. Only revertable concern is keeping the docs accurate as the codebase evolves — that's an ongoing maintenance concern, not a delivery risk.
