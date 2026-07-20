# Development environment

How to build, run, smoke-test, lint, and typecheck Workshop locally. This
document is the **fork's contributor guide**; the upstream repo's
`CONTRIBUTING.md` does not exist here, and `ai-docs/AGENTS.md` is the
nearest equivalent (see *Known gaps* below).

Every claim below is cited inline with the form `` `path:LL` `` so the
next contributor can audit it against the source.

---

## Environment variables reference

Every env var that changes dev or runtime behaviour. Cloud-only vars are
flagged "removed in F-001" — see `openspec/changes/remove-cloud-codecs`
(the F-001 change) for the deletion plan.

| Name | Type | Default | Purpose | Source |
|---|---|---|---|---|
| `RAINDROP_WORKSHOP_PORT` | int | `5899` | Port the daemon listens on for HTTP + WebSocket. Override when 5899 is taken. | `src/index.ts:58` |
| `RAINDROP_WORKSHOP_BIND_HOST` | string | loopback | Network interface to bind. Defaults to loopback; set to `0.0.0.0` only on trusted LANs. | `src/index.ts:59` |
| `RAINDROP_WORKSHOP_DB_PATH` | path | `~/.raindrop/raindrop_workshop.db` | SQLite file location. Parent dir must be writable. | `src/db.ts:20-26` |
| `RAINDROP_WORKSHOP_URL` | URL | derived from port | Canonical URL the CLI reports to the user (`raindrop workshop` printed banner). | `src/index.ts:112` |
| `RAINDROP_WORKSHOP_UI_PORT` | int | `5900` | Vite dev-server port used by the `dev` script. Backend port (`5899`) is **not** affected. | `package.json:22` |
| `RAINDROP_WORKSHOP_ALLOWED_ORIGINS` | CSV | unset | Origins allowed through CORS / WebSocket origin checks. Loopback is always allowed. | `src/server.ts:444` |
| `RAINDROP_WORKSHOP_CLAUDE_CLI_CHAT` | bool | unset | Enables the Claude-Code CLI chat sidepanel. **Removed in F-002** (`openspec/changes/narrow-to-opencode`). | `src/server.ts:441` |
| `RAINDROP_LOCAL_DEBUGGER` | URL | `http://localhost:5899/v1/` | The base URL that the companion plugin / Raindrop SDK uses to ship spans. Written into `./.env` by `raindrop workshop setup` so plugin code can pick it up without polluting the user shell. | `src/index.ts:451`, `src/agents-config.ts:464` |
| `RAINDROP_MANIFEST_URL` | URL | upstream manifest | URL the `raindrop update` command polls for new versions. | `src/index.ts` (update flow) |
| `DEBUGGER_DEV` | bool | unset | When set, the daemon **skips** mounting the built Vite SPA at the catch-all `GET *` route. Use this when running `dev:ui` separately so the daemon does not serve a stale bundle. | `src/server.ts:2309` |
| `RAINDROP_QUERY_API_KEY` | string | unset | Cloud query API key. **Removed in F-001** (`openspec/changes/remove-cloud-codecs`). | cloud-only |
| `RAINDROP_WRITE_KEY` | string | unset | Cloud ingest write key. **Removed in F-001**. | cloud-only |

### Worked example: run the daemon on port 6000

```bash
RAINDROP_WORKSHOP_PORT=6000 bun run dev
# daemon → http://localhost:6000
# Vite UI → http://localhost:5900 (unchanged — override with RAINDROP_WORKSHOP_UI_PORT)
```

If you also want the plugin to ship to the new port, update `.env`:

```bash
echo "RAINDROP_LOCAL_DEBUGGER=http://localhost:6000/v1/" >> .env
# or: raindrop workshop setup  (rewrites .env from RAINDROP_WORKSHOP_PORT)
```

---

## `bun run` script catalog

Every script in `package.json`'s `scripts` block (`package.json:17-41`).
Category column: **dev** = local iteration, **build** = release
artifacts, **lint** = code quality, **DB** = schema / migrations,
**other** = one-off utilities.

| Name | Command | Category | When to use | Prereqs |
|---|---|---|---|---|
| `dev` | `bun run link-dev && bun --watch src/index.ts workshop serve & (printf "…"; cd app && bun x vite --force) & wait` (`package.json:22`) | dev | **First-time contributors.** Starts daemon (with `--watch`) and Vite dev server in parallel. Daemon on `5899`, UI on `5900`. | `bun install` already run. |
| `dev:server` | `bun --watch src/index.ts workshop serve` (`package.json:25`) | dev | Daemon only, foreground, auto-restart on TS change. Use when iterating on backend without touching the UI. | None beyond `bun install`. |
| `dev:ui` | `cd app && bun x vite --force` (`package.json:26`) | dev | Vite dev server only. Connect to an already-running daemon (or `dev:server` in another shell). Set `DEBUGGER_DEV=1` on the daemon so it doesn't shadow Vite with the built SPA. | Daemon reachable at `5899`. |
| `link-dev` | `ln -sf ../bin/raindrop-dev node_modules/.bin/raindrop-dev` (`package.json:23`) | dev | Internal helper — symlinks the local dev binary so `dev` can spawn the daemon via `raindrop-dev`. Auto-run by `postinstall`. | `bin/raindrop-dev` exists (it does in this repo). |
| `postinstall` | `bun run link-dev` (`package.json:24`) | other | Runs automatically after `bun install`. | — |
| `start` | `bun src/index.ts workshop serve` (`package.json:34`) | dev | Daemon, foreground, **no watch**. Closest to a release-mode local run. | — |
| `build` | `bun scripts/embed-migrations.ts --check && bun x tsc --noEmit && bun run build:ui` (`package.json:18`) | build | Full release pipeline. Fails if migrations are stale (see `db:embed`), if TypeScript errors exist, or if the UI build fails. | Migrations must be already embedded; otherwise run `db:embed` first. |
| `build:ui` | `cd app && bun x vite build` (`package.json:19`) | build | Builds the React SPA into `app/dist/`. Daemon serves this bundle from `GET *` (`src/server.ts:2312`) unless `DEBUGGER_DEV=1`. | — |
| `build:bun` | `bun scripts/build-bun.ts` (`package.json:20`) | build | Compiles the `raindrop` Bun binary for the current platform. | Already-built UI in `app/dist/` (run `build:ui` first). |
| `build:bun:all` | `bun scripts/build-bun.ts --all` (`package.json:21`) | build | Cross-compile binaries for every supported platform. | Same as `build:bun`. |
| `lint` | `eslint .` (`package.json:37`) | lint | Static-analysis gate. Zero errors = pass. Config: `eslint.config.mjs` (see *Lint and typecheck*). | — |
| `lint:fix` | `eslint . --fix` (`package.json:38`) | lint | Same as `lint` but applies auto-fixes. | — |
| `db:generate` | `drizzle-kit generate && bun scripts/embed-migrations.ts` (`package.json:28`) | DB | After editing `src/db/schema.ts`: emits SQL into `drizzle/`, then re-embeds SQL into the daemon binary. **Always run both halves** — a stale embed fails `build`. | `drizzle-kit` installed (it is, in `devDependencies`). |
| `db:embed` | `bun scripts/embed-migrations.ts` (`package.json:29`) | DB | Re-embeds existing `drizzle/*.sql` into the daemon. Use when SQL was edited by hand without a schema change. | — |
| `db:migrate` | `drizzle-kit migrate` (`package.json:30`) | DB | Applies migrations to the local DB. **Dev only** — the production daemon self-migrates on boot via `src/db.ts:71-90`. | — |
| `db:studio` | `drizzle-kit studio` (`package.json:31`) | DB | Opens Drizzle Studio against the local SQLite file. Read-only browsing of runs / spans / events. | Daemon stopped (to avoid WAL contention) or run against a copy. |
| `seed:traces` | `bun scripts/seed-traces.ts` (`package.json:33`) | other | Populate the DB with sample traces for manual UI exploration. | Daemon reachable. |
| `test` | `bun test tests/` (`package.json:35`) | lint | **Broken.** The `tests/` directory does not exist in this fork. See *Known gaps*. | — |
| `test:watch` | `bun test tests/ --watch` (`package.json:36`) | lint | **Broken** for the same reason. | — |
| `setup` | `bash .devin/setup.sh` (`package.json:32`) | other | Devin-CI bootstrap. Not used during local dev. | — |
| `manifest` | `bun scripts/generate-manifest.ts` (`package.json:39`) | other | Regenerate the self-update manifest consumed by `raindrop update`. Run after cutting a release. | — |
| `install:local` | `bun scripts/install-local.ts` (`package.json:40`) | other | Internal install hook used by the `raindrop` CLI when installing itself into `~/.raindrop`. | — |
| `dev:examples` | `bun scripts/dev-all.ts` (`package.json:27`) | dev | Run the example apps under `examples/` (each is a small agent that emits to the daemon). Useful for generating realistic traces. | Daemon already running. |

### `dev` vs `dev:server` vs `dev:ui`

This is the most common trip-hazard for new contributors.

- **`dev`** runs **both** processes in parallel — daemon in the
  background, Vite in the foreground. Logs interleave in the same
  terminal. This is the right command 95% of the time.
- **`dev:server`** runs the daemon **only**, in the foreground. Use when
  you are debugging backend code and want clean logs without Vite noise.
- **`dev:ui`** runs Vite **only**. Use when you are iterating on the
  React UI and want hot-reload without restarting the daemon. You must
  start the daemon separately (`dev:server` in another shell). Set
  `DEBUGGER_DEV=1` on the daemon so its catch-all `GET *` route does
  not shadow Vite with the stale built bundle (`src/server.ts:2309`).

---

## Smoke-test procedure

A two-minute end-to-end check for doc-only or schema-only changes. All
five steps must succeed; if any fails, stop and investigate before
proceeding.

1. **Start the daemon.**
   ```bash
   bun install        # first time only
   bun run dev
   ```
   *Success condition:* the daemon prints its banner (reporting
   `http://localhost:5899`) and Vite prints `Vite UI: http://localhost:5900`.
   No stack traces in the first 5 seconds.

2. **Confirm the daemon responds.**
   ```bash
   curl -sf http://localhost:5899/health && echo OK
   ```
   *Success condition:* `OK` is printed and the exit code is 0. The
   `/health` handler is at `src/server.ts:708`.

3. **Emit a span.** Either route:
   - **Plugin path** — start any agent instrumented with the Raindrop
     SDK / OpenCode plugin and let it produce one tool call, or
   - **Synthetic path** — ship a minimal OTLP JSON trace via curl:
     ```bash
     curl -sX POST http://localhost:5899/v1/traces \
       -H 'content-type: application/json' \
       -d '{"resourceSpans":[{"scopeSpans":[{"spans":[{
         "traceId":"00000000000000000000000000000001",
         "spanId":"0000000000000001",
         "name":"smoke.test","kind":1,
         "startTimeUnixNano":"1700000000000000000",
         "endTimeUnixNano":"1700000001000000000",
         "attributes":[{"key":"raindrop.span.kind","value":{"stringValue":"trace"}}]
       }]}]}]}'
     ```
   *Success condition:* response body `{"ok":true,"spansIngested":1}`
   (handler at `src/server.ts:739`, response shape at `:752,:813`).

4. **Verify the run landed in the DB.**
   ```bash
   curl -s 'http://localhost:5899/api/runs?limit=1' | jq '.'
   ```
   *Success condition:* the JSON array is non-empty and the top entry's
   `started_at` is recent (within the last minute). The `/api/runs`
   handler is at `src/server.ts:998`.

5. **Open the UI and click through.**
   - Open `http://localhost:5900` in a browser.
   - Click into the run produced in step 3.
   - *Success condition:* the span tree renders with the span from step
     3 visible. WebSocket updates (`broadcast("spans", …)`) flow through
     the WS endpoint at `src/server.ts:413-424`.

If all five pass, the change is end-to-end safe. If a step fails, jump
to the cited source line and inspect.

---

## Build matrix and prerequisites

### Toolchain

| Tool | Required version | How to verify | Source |
|---|---|---|---|
| Bun | `>=1.3.13` | `bun --version` | `package.json:11-13` (`engines.bun`) |
| Node | not required | — | Bun is the only runtime |
| OS | Linux, macOS confirmed; Windows untested | — | No platform gate in source; community reports only |

### Bun supply-chain cooldown

`bunfig.toml:18-30` enforces a 3-day minimum release age
(`minimumReleaseAge = 259200` seconds) on every `bun add` / `bun update`
/ non-frozen `bun install`. If a semver range matches only too-young
versions, install fails. Workarounds:

- **Persistent (audit-friendly):** add the package to
  `minimumReleaseAgeExcludes` in `bunfig.toml:23-30`.
- **One-off:** `bun add <pkg> --minimum-release-age 0`.
- **CI:** `bun install --frozen-lockfile` skips resolution entirely and
  is unaffected.

Our own published SDKs (`raindrop-ai`, `@raindrop-ai/*`) are already on
the exclude list so we can consume fresh releases without waiting.

### What `bun run build` produces

Per `package.json:18`, `build` runs three sub-steps in sequence:

1. `bun scripts/embed-migrations.ts --check` — fails if the embedded
   migration SQL is out of date relative to `drizzle/*.sql`.
2. `bun x tsc --noEmit` — backend TypeScript typecheck.
3. `bun run build:ui` → `cd app && bun x vite build` — emits the React
   SPA into `app/dist/`.

The full release binary (`build:bun` / `build:bun:all`) bundles the
daemon plus the embedded UI into a single `raindrop` executable via
`scripts/build-bun.ts`.

---

## Lint and typecheck commands

### Lint

```bash
bun run lint        # check
bun run lint:fix    # autofix
```

- Config: `eslint.config.mjs` (flat config, ESLint 9).
- Backend files (`src/**/*.ts`, `scripts/**/*.ts`, `app/tests-e2e/**/*.ts`)
  are type-checked via `tseslint.configs.recommendedTypeChecked`
  (`eslint.config.mjs:24-28,:64`). Notable backend rules:
  - `@typescript-eslint/no-floating-promises: error` — every promise
    must be awaited / caught / voided.
  - `@typescript-eslint/no-misused-promises: error` — no async functions
    where a sync signature is expected.
  - `no-empty: error` with `allowEmptyCatch: true` — empty blocks are
    flagged **except** empty `catch` blocks.
  - Several `no-unsafe-*` rules are explicitly turned **off** to keep
    the codebase navigable (`eslint.config.mjs:79-87`).
- UI files (`app/src/**/*.{ts,tsx}`) use React + jsx-runtime +
  react-hooks configs (`eslint.config.mjs:100-151`).
- **Success condition:** zero errors. Warnings are acceptable but rare.

Common failures:

| Symptom | Cause | Fix |
|---|---|---|
| `Floating promise returned from ...` | A promise is not awaited | Add `await`, `.catch`, or `void` |
| `Promise-returning function provided to ... where void return expected` | An async function is passed to a non-async callback slot | Wrap in a void-returning arrow, or restructure |
| `Parsing error: … project service disabled` | Linting a backend TS file without `tsconfig.eslint.json` in scope | Confirm `parserOptions.project` matches `eslint.config.mjs:69` |

### Typecheck

There are **two** TypeScript projects — one per workspace — and they
must both pass.

| Scope | Command | Config |
|---|---|---|
| Backend daemon (`src/`, `scripts/`) | `bun x tsc --noEmit` | `tsconfig.json` |
| React UI (`app/src/`) | `cd app && bun x tsc --noEmit` (or `bun run typecheck` in `app/`) | `app/tsconfig.json` |

The release `build` script only runs the backend typecheck
(`package.json:18`). The UI typecheck is bundled into `app/package.json`'s
`build` script (`tsc --noEmit && vite build`).

- **Success condition:** zero errors from each invocation.
- Common failures:
  - **`Cannot find module '@raindrop-ai/…'`** — SDK package not yet
    installed or blocked by the supply-chain cooldown. Run
    `bun install`; if it fails on a too-young version, see
    `bunfig.toml` notes above.
  - **`Property 'X' does not exist on type 'Y'`** after a schema edit
    — Drizzle generates new types from `src/db/schema.ts`; run
    `bun run db:generate` so the SQL **and** the embedded TypeScript
    artefact are up to date.

### Pre-commit checklist

```bash
bun run lint
bun x tsc --noEmit
(cd app && bun x tsc --noEmit)
```

All three clean = ready for review.

---

## Known gaps

Honest documentation of missing infrastructure so contributors do not
waste time looking for things that do not exist.

### `tests/` directory does not exist

`package.json:35` declares `"test": "bun test tests/"`, but the
top-level `tests/` directory does **not** exist in this fork. Running
`bun run test` (or `bun run test:watch`) fails with `No test files found`.

This is a known upstream gap, not a broken local setup. **The actual
test suite is the Playwright e2e specs at `app/tests-e2e/`** (14 specs
covering chat flows for the SDK adapters — `ai-sdk-chat.spec.ts`,
`anthropic-chat.spec.ts`, `opencode-plugin-chat.spec.ts`, etc.). They
run via Playwright, not Bun's test runner:

```bash
cd app
bunx playwright install chromium   # first time only
bun run test:e2e                   # = playwright test
```

Config: `app/playwright.config.ts` (sets `testDir: "./tests-e2e"`,
90 s timeout, single worker locally, 2 in CI).

### No `CONTRIBUTING.md`

The fork does not ship a `CONTRIBUTING.md`. Its role is filled by:

- **`ai-docs/AGENTS.md`** — the contributor / agent quick-reference,
  including the canonical doc-index table at `ai-docs/AGENTS.md:85-95`.
- **This file (`ai-docs/DEVELOPMENT.md`)** — environment + scripts +
  smoke-test.
- **`ai-docs/ARCHITECTURE.md`** — module map and data flow.
- **`ai-docs/API.md`** — HTTP + WebSocket surface.

If you arrive looking for "how to contribute", start at
`ai-docs/AGENTS.md`, then come back here.

### Other gaps worth flagging

- **Cloud-only env vars (`RAINDROP_QUERY_API_KEY`, `RAINDROP_WRITE_KEY`)
  are still parsed** in the source today even though cloud support is
  slated for removal in F-001 (`openspec/changes/remove-cloud-codecs`).
  Do not rely on them in new code.
- **Claude-specific endpoints** (`/api/claude/*`) and the
  `RAINDROP_WORKSHOP_CLAUDE_CLI_CHAT` env var are slated for removal in
  F-002 (`openspec/changes/narrow-to-opencode`). Treat them as
  deprecated.
- **Sub-agent attribute-name contract** is in flux pending F-003
  (`openspec/changes/opencode-task-subagent-attrs`). The daemon today
  detects sub-agents purely from span-tree shape; do not assume
  attribute keys like `subagent_name` are read. See
  `ai-docs/PLUGIN-CONTRACT.md` § *Sub-agent metadata expectation*.

---

## Source anchors

The citations above point at the following authoritative files. Re-read
the cited lines before changing the documented behaviour.

| Anchor | File |
|---|---|
| `package.json:11-13` | Bun engine constraint |
| `package.json:17-41` | All scripts |
| `bunfig.toml:18-30` | Bun supply-chain cooldown |
| `eslint.config.mjs:9-99` | Backend lint rules |
| `eslint.config.mjs:100-151` | UI lint rules |
| `src/index.ts:58-59` | Port / bind-host env vars |
| `src/index.ts:112` | `RAINDROP_WORKSHOP_URL` |
| `src/index.ts:451` | `RAINDROP_LOCAL_DEBUGGER` written by `setup` |
| `src/db.ts:20-26` | DB path env var |
| `src/db.ts:71-90` | Daemon boot-time migration |
| `src/server.ts:413-424` | WebSocket server |
| `src/server.ts:441` | Claude CLI chat env var |
| `src/server.ts:444` | Allowed-origins env var |
| `src/server.ts:708` | `/health` handler |
| `src/server.ts:739,:752,:813` | OTLP ingest handler + response shape |
| `src/server.ts:998` | `/api/runs` handler |
| `src/server.ts:2309` | `DEBUGGER_DEV` short-circuit |
| `src/agents-config.ts:464` | Plugin-side base URL |
| `tsconfig.json`, `tsconfig.eslint.json` | Backend typecheck configs |
| `app/tsconfig.json` | UI typecheck config |
| `app/playwright.config.ts` | Playwright e2e config |
| `app/tests-e2e/` | Actual test suite |
