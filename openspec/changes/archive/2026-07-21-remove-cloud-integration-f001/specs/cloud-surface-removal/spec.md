## ADDED Requirements

### Requirement: No cloud source code remains in the daemon

After this change, no file under `src/` SHALL import from, reference, or transitively depend on any cloud SaaS endpoint (`app.raindrop.ai`, Raindrop Query API, cloud MCP proxy, cloud skills marketplace, OAuth, write-key storage). The directories `src/cloud/` and `src/auth/` SHALL NOT exist.

#### Scenario: Build passes with no cloud imports

- **WHEN** a contributor runs `bun run build` (which executes `bun scripts/embed-migrations.ts --check && bun x tsc --noEmit && bun run build:ui`) from repo root after the change
- **THEN** the command exits 0 with no TypeScript errors about missing modules or unresolved imports from `./cloud/*` or `./auth/*`

#### Scenario: Grep sweep returns no cloud references

- **WHEN** a contributor runs `grep -rn "raindrop\.ai\|apiKeyHealth\|RAINDROP_CLOUD\|app\.raindrop\|cloud setup\|cloudMcp\|writeKey\|write_key\|cmdLogin\|cmdLogout\|cloud-mcp\|cloudMcpUrl\|cloud/skills\|cloud/offer\|cloud/setup\|cloud/uninstall\|cloud/apply\|cloud/env-file\|cloud/query-client\|cloud/query-key\|cloud/import-trace\|cloud/transient-keys\|cloud/constants" src/`
- **THEN** the command returns zero matches

#### Scenario: Local daemon starts without cloud dependencies

- **WHEN** a contributor starts the daemon via `bun run dev` (with user permission) after the change
- **THEN** the daemon starts on `localhost:5899` without any 401, OAuth challenge, or write-key prompt; no `RAINDROP_WRITE_KEY` env var is required

### Requirement: server.ts cloud wiring is fully stripped

`src/server.ts` SHALL have no imports from `./cloud/import-trace`, `./cloud/query-client`, `./cloud/query-key`, `./cloud/transient-keys`, `./cloud/cloud-mcp-proxy` (currently at L50-54). The `cloudMcpUrl` import from `./agent-chat` (currently L27) and its usage at L693 (`upstreamUrl: () => cloudMcpUrl()`) SHALL be removed. Any code block that referenced these symbols SHALL be either deleted (if its sole purpose was cloud routing) or refactored to remove the cloud call (if cloud was an optional branch).

#### Scenario: server.ts contains zero cloud imports

- **WHEN** a contributor runs `grep -nE "from \"\\./cloud|cloudMcpUrl|importCloudTrace|queryApiGet|normalizeQueryApiKey|TransientQueryApiKeyStore|CLOUD_MCP_PROXY_PATH|bearerTokenFromHeader|createCloudMcpProxy" src/server.ts src/agent-chat.ts`
- **THEN** the command returns zero matches in `src/server.ts`. `cloudMcpUrl` definition in `src/agent-chat.ts:150` is also removed (its only consumer was `src/server.ts`).

### Requirement: CLI no longer exposes cloud/auth commands

`src/index.ts` SHALL have no import of `cmdLogin` or `cmdLogout` from `./auth/login` (currently L46). The CLI case branches at L824 (`cmdLogin`) and L827 (`cmdLogout`) SHALL be removed. The CLI help text SHALL NOT list `raindrop login`, `raindrop logout`, `raindrop cloud setup`, or `raindrop cloud uninstall` as available commands.

#### Scenario: raindrop login is not a recognized command

- **WHEN** a user runs `bun src/index.ts login` (or the installed `raindrop login` binary after this change)
- **THEN** the CLI responds with "Unknown command: login" (or equivalent default for unrecognized commands), not with an OAuth flow

#### Scenario: raindrop cloud setup is not a recognized command

- **WHEN** a user runs `raindrop cloud setup` after this change
- **THEN** the CLI responds with "Unknown command: cloud" (or equivalent), confirming the cloud subcommand tree is gone

### Requirement: installer does not prompt for cloud

`install.sh` SHALL NOT recognize the `--cloud` flag (currently L316), SHALL NOT read the `RAINDROP_CLOUD` env var (currently L327,342-344), SHALL NOT call `setup_cmd=(cloud setup)` (currently L729), and SHALL NOT mention Raindrop Cloud in its help text (currently L281-282,319,342-344). The installer SHALL only run the local-debugger setup path.

#### Scenario: --cloud flag is rejected

- **WHEN** a user runs `bash install.sh --cloud` after this change
- **THEN** the installer either (a) treats `--cloud` as an unknown flag and errors out per its existing unknown-flag handling, or (b) prints a warning that `--cloud` is no longer supported and continues with local-only setup. It MUST NOT execute any cloud-setup step.

#### Scenario: RAINDROP_CLOUD env var is ignored

- **WHEN** a user runs `RAINDROP_CLOUD=1 bash install.sh` after this change
- **THEN** the installer runs the local-debugger setup only, identical to running without the env var

### Requirement: README no longer documents cloud features

`README.md` SHALL NOT contain a "Raindrop Cloud" section (currently L49-103) or cloud-related CLI entries (currently L130-133: `raindrop login`, `raindrop logout`, `raindrop cloud setup`, `raindrop cloud uninstall`). The README SHALL document ONLY the local-debugger install, configuration, and CLI commands.

#### Scenario: User reads README to learn what Workshop is

- **WHEN** a new user reads `README.md` after this change
- **THEN** they encounter only the local-debugger instructions (install one-liner, env vars, local CLI commands) and never see a reference to `app.raindrop.ai`, OAuth, paid plans, or write keys

### Requirement: package.json drops cloud-only deps (if audit confirms)

If the commit-4 audit confirms that `@clack/prompts` (L45) and/or `@raindrop-ai/ai-sdk` (L47) are used ONLY by `src/cloud/*` or `src/auth/*` code, they SHALL be removed from `package.json` `dependencies`. `raindrop-ai` (L56) and `@ai-sdk/openai` (L44) SHALL remain. `@ai-sdk/anthropic` (L43) and `@raindrop-ai/claude-agent-sdk` (L48) are OUT of scope (F-002).

#### Scenario: bun install succeeds after deps removal

- **WHEN** a contributor runs `bun install` after the deps audit commit
- **THEN** the command exits 0, `bun.lock` is updated to reflect the removed deps, and no remaining source file imports the removed packages

#### Scenario: Daemon parts still work without removed deps

- **WHEN** a contributor runs `bun run dev` after the deps removal
- **THEN** the daemon starts successfully and serves the local UI, proving that `raindrop-ai` (the meta-package) provides all needed daemon primitives and the removed deps were truly cloud-only

### Requirement: PLAN.md F-001 entry is closed out

`ai-docs/PLAN.md` SHALL have all F-001 checkboxes (currently L213-223) flipped to `[x]` and the F-001 entry SHALL be moved from "## Active Features" to "## Closed Features" (currently L237-239) with a "Closed YYYY-MM-DD" note matching the commit date.

#### Scenario: Future contributor checks F-001 status

- **WHEN** a future contributor opens `ai-docs/PLAN.md` after this change
- **THEN** they find F-001 in the "Closed Features" section with all checkboxes ticked and a closing date, making clear that cloud removal is complete and not to be re-attempted

### Requirement: Final smoke test passes (regression bar)

With explicit user permission to start the daemon, the change SHALL pass the regression bar end-to-end: (1) `bun install` succeeds, (2) `bun run build` succeeds, (3) `bun run dev` starts the daemon on `localhost:5899`, (4) an OpenCode session running with the companion plugin publishes a span, (5) `curl http://localhost:5899/api/runs?limit=1` returns the new run as JSON, (6) the UI at `http://localhost:5899` renders the run and span tree.

#### Scenario: OpenCode trace streams end-to-end after cloud removal

- **WHEN** the user (with explicit permission granted) starts the daemon and runs an OpenCode session with the companion plugin
- **THEN** a span lands in the local SQLite DB, the API returns it, and the UI renders the span tree — proving cloud removal did not break the local-only stack
