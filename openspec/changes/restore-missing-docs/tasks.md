# Tasks — restore-missing-docs

> All work happens under `ai-docs/`. No source code, deps, or upstream-owned files (`docs/`, root `AGENTS.md`, `LICENSE`, `bun.lock`) are touched.
> One Feature = one commit. The whole change ships as **one commit** at the end (Task 7) — tasks 1–6 are file creation that the worker can stage and verify individually before the single commit.
> Never `git push` — that requires explicit user instruction.

## 1. Reconnaissance — verify anchors before writing

- [x] 1.1 Read `src/index.ts`, `src/server.ts` (first 200 lines), `src/db/schema.ts`, `src/spans/normalize.ts`, `src/agents.ts`, `src/replay.ts`, `src/parse.ts`, `src/otlp-protobuf.ts` and note exact line ranges for the symbols each doc will cite.
- [x] 1.2 Inventory every `/api/*` route in `src/server.ts` by grepping for the route-registration pattern (e.g. `app.get(`, `app.post(`, `router.get(`, Hono-style route macros). Capture: method, path, line range.
- [x] 1.3 Inventory every WebSocket event handler in `src/server.ts` (search `ws.on(`, `socket.on(`, `c.socket.` or whatever the framework uses). Capture: event name, direction, line range.
- [x] 1.4 Inventory every table in `src/db/schema.ts` (search `sqliteTable(`). Capture: table name, line range, columns.
- [x] 1.5 Inventory every script in `package.json` under `"scripts"`. Capture: name, command, one-line purpose.
- [x] 1.6 **Verification:** write the inventories to `openspec/changes/restore-missing-docs/.inventories.md` (a scratch file, NOT committed) so tasks 2–6 can cite line ranges without re-grepping.

## 2. Write `ai-docs/ARCHITECTURE.md`

- [x] 2.1 Create `ai-docs/ARCHITECTURE.md` with sections derived from `specs/architecture-doc/spec.md`: Module map of src/, End-to-end data flow, Upstream-vs-fork boundary, Citation of source anchors.
- [x] 2.2 Fill the module map table with entries for every module listed in spec requirement "Module map of src/" — each row has: path, responsibility, key exports, ownership tag (`upstream` / `fork-only` / `fork-modified`).
- [x] 2.3 Fill the data flow section tracing plugin emit → ingest → decode → normalize → SQLite → WS → React UI, with `path:LL` citations for each step.
- [x] 2.4 Fill the boundary section listing `AGENTS.md`, `docs/`, `LICENSE`, `bun.lock` as upstream-owned; `ai-docs/`, `openspec/`, `.opencode/`, `.omo/` as fork-only.
- [x] 2.5 **Verification:** every section has at least one `path:LL`-format citation; spot-check 3 citations by opening the cited file and confirming the line says what the doc claims. Confirm Mermaid/Markdown renders correctly if a diagram is included.

## 3. Write `ai-docs/API.md`

- [x] 3.1 Create `ai-docs/API.md` with sections derived from `specs/api-reference-doc/spec.md`: HTTP route catalog, WebSocket event catalog, Status code and error shape reference, Auth and config caveats, Source citation per route.
- [x] 3.2 Fill the HTTP route catalog using the inventory from Task 1.2. Each entry: method, path, query, request body shape (or "none"), response shape, status codes, one `curl` example, one-line description, `src/server.ts:LL` citation.
- [x] 3.3 Fill the WebSocket event catalog using the inventory from Task 1.3. Each entry: event name, direction, payload shape, trigger condition, `src/server.ts:LL` citation.
- [x] 3.4 Fill the error shape reference. List 4xx/5xx statuses with response body shape (`{ error, code }` or whatever the daemon emits) and trigger conditions.
- [x] 3.5 Fill the auth-and-config caveats section. State: no auth (local-only), env vars table (`RAINDROP_WORKSHOP_PORT`, `RAINDROP_WORKSHOP_DB_PATH`, `RAINDROP_LOCAL_DEBUGGER`), forward-pointer to F-001 for cloud-auth history.
- [x] 3.6 **Verification:** grep the doc for "TODO" / "TBD" / "FIXME" — must return zero matches. Pick 2 routes at random and `curl` them against a running daemon (or confirm via dry-run that the route shape matches the source). Confirm every route has a citation.

## 4. Write `ai-docs/DATABASE.md`

- [x] 4.1 Create `ai-docs/DATABASE.md` with sections from `specs/database-schema-doc/spec.md`: Table-by-table schema reference, Migration workflow, DB path and env var reference, ER diagram or relations description, Backup/reset/inspection recipes.
- [x] 4.2 Fill one section per table from the Task 1.4 inventory: table name, purpose, every column (name/type/nullable/default), every index, every FK, `src/db/schema.ts:LL` citation.
- [x] 4.3 Fill the migration workflow section with `bun run db:generate`, `bun run db:embed`, `bun run db:migrate` — for each: what it does, when to run it (dev vs release), where output goes (`drizzle/` dir for generated SQL).
- [x] 4.4 Fill the DB path section. Document default (`~/.raindrop/raindrop_workshop.db`), env var override (`RAINDROP_WORKSHOP_DB_PATH`), and the no-auto-migrate caveat.
- [x] 4.5 Include a Mermaid ER diagram OR a textual relations description covering `runs` ↔ `spans` ↔ `annotations` ↔ `saved_events` linkages. If Mermaid, fenced-block ```mermaid so GitHub renders it.
- [x] 4.6 Include the Operations section with copy-paste recipes: backup (cp), reset (`raindrop workshop reset` or `rm`), inspect (`sqlite3` CLI examples).
- [x] 4.7 **Verification:** open the SQLite file (or run a fresh `bun run dev` then open it) and confirm every column listed in the doc actually exists. If you can't run the daemon, cross-check by reading `src/db/schema.ts` lines cited.

## 5. Write `ai-docs/PLUGIN-CONTRACT.md`

- [x] 5.1 Create `ai-docs/PLUGIN-CONTRACT.md` with sections from `specs/plugin-contract-doc/spec.md`: OTLP ingest endpoint contract, Span shape contract, Environment variable contract, Sub-agent metadata expectation, Versioning and stability statement.
- [x] 5.2 Document the ingest endpoint (path, method, accepted `Content-Type`s, request body shape, response codes, base URL). Cite `src/parse.ts` and `src/otlp-protobuf.ts` lines.
- [x] 5.3 Document the span shape (required fields, optional fields, `span.kind` enum values, OpenCode `task`-tool sub-agent conventions). Cite `src/spans/normalize.ts`.
- [x] 5.4 Document every env var the plugin must set or respect (at minimum `RAINDROP_LOCAL_DEBUGGER`). Cross-reference API.md's env var table.
- [x] 5.5 Document the sub-agent metadata expectation — which attributes Workshop's `src/agents.ts` reads to name a sub-agent. Forward-reference F-003 (`ai-docs/PLAN.md`) for the UI work.
- [x] 5.6 Add a Stability section: which parts are stable (ingest endpoint, required fields) vs in-flux (sub-agent attribute names pending F-003).
- [x] 5.7 **Verification:** cross-check the documented ingest endpoint against `src/parse.ts` — the doc's path and method MUST match the source exactly. Confirm span field names match `NormalizedSpan` definition in `src/spans/normalize.ts`.

## 6. Write `ai-docs/DEVELOPMENT.md`

- [x] 6.1 Create `ai-docs/DEVELOPMENT.md` with sections from `specs/development-environment-doc/spec.md`: Environment variables reference, bun run script catalog, Smoke-test procedure, Build matrix and prerequisites, Known gaps, Lint and typecheck commands.
- [x] 6.2 Fill the env var table using the Task 1.5 inventory plus any env var referenced in `src/server.ts`, `src/index.ts`, `src/parse.ts`. Mark cloud-only env vars (`RAINDROP_WRITE_KEY`) as "removed in F-001".
- [x] 6.3 Fill the bun run script catalog using the Task 1.5 inventory. Each entry: name, command, when-to-use (dev/build/lint/db/other), prerequisites. Especially document the difference between `dev`, `dev:server`, `dev:ui`.
- [x] 6.4 Fill the smoke-test procedure with the 5 numbered steps from spec requirement "Smoke-test procedure". For each, state the success condition explicitly.
- [x] 6.5 Fill the build matrix: Bun version (from `package.json` engines or `bunfig.toml`), OS support (Linux/macOS confirmed; Windows untested), what `bun run build` produces and where.
- [x] 6.6 Fill the Known gaps section: (a) absence of `tests/` dir despite `package.json:35` referencing `"test": "bun test tests/"`; (b) absence of CONTRIBUTING.md (fork uses `ai-docs/AGENTS.md` instead).
- [x] 6.7 Fill the lint (`bun run lint`, config in `eslint.config.mjs`) and typecheck (`bun x tsc --noEmit`) section with success conditions.
- [x] 6.8 **Verification:** on a clean checkout, follow the DEVELOPMENT.md prerequisites + `bun install` + `bun run dev` instructions literally — they MUST work without improvisation. If `bun run dev` requires a step the doc doesn't mention, add the step.

## 7. Update `ai-docs/AGENTS.md` Quick Reference + commit

- [x] 7.1 Add five rows to the "Quick reference" table in `ai-docs/AGENTS.md`, one per new doc. Keep the existing table structure; do not edit other parts of the file.
- [x] 7.2 **Verification A:** `bun run lint` from repo root — must pass (catches markdown-related issues if any lint rule covers `.md`).
- [x] 7.3 **Verification B:** run the per-doc verification from tasks 2.5, 3.6, 4.7, 5.7, 6.8 one final time after all files exist. Fix any drift.
- [x] 7.4 **Verification C:** grep for unresolved markers in all new docs: `grep -E "TODO|TBD|FIXME|XXX" ai-docs/{ARCHITECTURE,API,PLUGIN-CONTRACT,DATABASE,DEVELOPMENT}.md` — must return zero matches.
- [x] 7.5 **Verification D:** confirm scope discipline — `git diff --name-only` should list ONLY: 5 new files under `ai-docs/`, one modified `ai-docs/AGENTS.md`, and any scratch files under `openspec/changes/restore-missing-docs/` that the worker chooses to commit alongside the change artifacts. No `src/`, `app/`, `bin/`, `scripts/`, `examples/`, `docs/`, `LICENSE`, `bun.lock`, root `AGENTS.md`, or `package.json` changes.
- [x] 7.6 Stage all changes and commit with message: `docs: restore technical reference set in ai-docs/`. Body should reference the OpenSpec change: `Openspec change: restore-missing-docs`. Do NOT include `git push` — push requires explicit user instruction.
