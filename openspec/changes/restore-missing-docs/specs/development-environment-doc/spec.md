## ADDED Requirements

### Requirement: Environment variables reference

The `ai-docs/DEVELOPMENT.md` document SHALL list every env var that affects dev or runtime behavior, with exact name, type, default, and purpose. MUST cover at minimum: `RAINDROP_WORKSHOP_PORT` (default `5899`), `RAINDROP_WORKSHOP_DB_PATH` (default `~/.raindrop/raindrop_workshop.db`), `RAINDROP_LOCAL_DEBUGGER` (SDK-side mirror target). Cloud-only env vars (`RAINDROP_WRITE_KEY`, OAuth tokens) MUST be marked "removed in F-001" with a forward pointer.

#### Scenario: Contributor wanting to run daemon on a different port

- **WHEN** a contributor needs port 6000 free for another service
- **THEN** the env var reference tells them to set `RAINDROP_WORKSHOP_PORT=6000` before `bun run dev`

### Requirement: bun run script catalog

The document SHALL list every script in `package.json`'s `scripts` block, with: script name, the exact command it runs, when to use it (dev / build / lint / DB / other), and any prerequisites. MUST cover at minimum: `dev`, `dev:server`, `dev:ui`, `build`, `lint`, `typecheck` (if present), `db:generate`, `db:embed`, `db:migrate`, `test`.

#### Scenario: New contributor running the project for the first time

- **WHEN** a new contributor clones the fork and wants to start the daemon
- **THEN** the script catalog tells them to run `bun install` then `bun run dev`, and explains the difference between `dev`, `dev:server`, and `dev:ui`

### Requirement: Smoke-test procedure

The document SHALL describe a smoke-test procedure with numbered steps and the success condition for each. MUST cover at minimum: (1) start daemon via `bun run dev`, (2) confirm `http://localhost:5899` responds, (3) trigger a span from the companion plugin (or a synthetic curl), (4) verify `curl http://localhost:5899/api/runs?limit=1` returns the new run, (5) open the UI in a browser, click into the run, and verify the span tree renders.

#### Scenario: Contributor verifying a non-destructive change

- **WHEN** a contributor has made a doc-only or DB-schema-only change and wants to confirm nothing broke
- **THEN** the smoke-test procedure lets them verify end-to-end in under two minutes, without inventing their own test steps

### Requirement: Build matrix and prerequisites

The document SHALL list the toolchain prerequisites (Bun version, Node version if applicable, OS support — Linux/macOS confirmed, Windows untested), and the build matrix (`bun run build` produces what artifacts, where they go). It MUST cite the relevant lines in `package.json` and `bunfig.toml`.

#### Scenario: Contributor on a fresh machine

- **WHEN** a contributor is setting up the project on a new machine
- **THEN** the prerequisites list tells them which Bun version to install (and how to verify), so `bun install` succeeds first time

### Requirement: Known gaps section

The document SHALL include a "Known gaps" section that documents missing infrastructure honestly, so contributors do not waste time looking for things that do not exist. MUST document at minimum: the absence of a `tests/` directory despite `package.json:35` referencing `"test": "bun test tests/"`, and the absence of a CONTRIBUTING.md (the fork uses `ai-docs/AGENTS.md` for that role instead).

#### Scenario: Contributor trying to run tests

- **WHEN** a contributor runs `bun run test` and gets "no tests found"
- **THEN** the known gaps section explains that `tests/` does not exist yet, so the contributor knows it is a known gap rather than a broken setup

### Requirement: Lint and typecheck commands

The document SHALL document the lint (`bun run lint`, ESLint config in `eslint.config.mjs`) and typecheck (`bun x tsc --noEmit`) commands, with the success condition (zero errors) and how to interpret common failures. MUST cite the relevant config files.

#### Scenario: Contributor about to commit

- **WHEN** a contributor is about to commit a change and wants to verify it is clean
- **THEN** the lint/typecheck section tells them which commands to run, so they catch issues before the user reviews the diff
