## ADDED Requirements

### Requirement: Daemon SHALL NOT expose Codex/Claude/Anthropic HTTP routes

The daemon SHALL NOT register HTTP routes whose path or behavior is specific to Codex CLI, Claude Code CLI, Claude Agent SDK, or the Anthropic API. Specifically, the routes `/api/claude/sessions`, `/api/claude/loadout`, `/api/claude/sessions/:id`, `/api/claude/ask-user-question/hook`, `/api/claude/ask-user-question/:id/answer`, `/api/claude/messages`, and `/api/models/anthropic` MUST return HTTP 404 after this change ships.

#### Scenario: Removed Claude route returns 404

- **WHEN** the daemon is running and a client requests `GET /api/claude/sessions`
- **THEN** the response status code MUST be HTTP 404

#### Scenario: Removed Anthropic models route returns 404

- **WHEN** the daemon is running and a client requests `GET /api/models/anthropic`
- **THEN** the response status code MUST be HTTP 404

#### Scenario: OpenCode routes still respond

- **WHEN** the daemon is running and a client requests `GET /api/providers/status`
- **THEN** the response status code MUST be HTTP 200 and the JSON body MUST NOT contain `claude_code` or `codex` capability keys

### Requirement: Agent provider model SHALL be OpenCode-only

The TypeScript type `AgentProviderId` exported from `src/agent-chat.ts` SHALL be exactly the literal union `"opencode"`. The runtime parser SHALL return `null` for any other value, and callers SHALL default to `"opencode"` when the parser returns `null`. The persisted `~/.raindrop/agent-provider.json` file SHALL be overwritten with `{"provider":"opencode"}` on the next provider-setting call if it contains a stale legacy value.

#### Scenario: Type narrows to opencode

- **WHEN** a contributor opens `src/agent-chat.ts` after F-002 ships
- **THEN** the type declaration of `AgentProviderId` MUST be `"opencode"` (single literal, not a union)

#### Scenario: Stale on-disk provider value is tolerated

- **WHEN** `~/.raindrop/agent-provider.json` contains `{"provider":"claude"}`
- **AND** the daemon starts up
- **THEN** the daemon MUST NOT crash
- **AND** the effective agent provider MUST be `"opencode"`

#### Scenario: Stale on-disk provider value is repaired

- **WHEN** `~/.raindrop/agent-provider.json` contains `{"provider":"codex"}`
- **AND** the daemon calls the provider-setter with `"opencode"`
- **THEN** the file on disk MUST be overwritten with `{"provider":"opencode"}`

### Requirement: Annotation source enum SHALL be exactly `["user","opencode"]`

The Drizzle schema for the `annotations.source` column in `src/db/schema.ts` SHALL declare the enum as exactly `["user","opencode"]`. The TypeScript `SOURCES` set in `src/annotations.ts` SHALL match exactly. The MCP tool annotation-source check in `src/mcp/tools.ts` SHALL accept only `"user"` and `"opencode"`.

#### Scenario: Schema narrows

- **WHEN** a contributor opens `src/db/schema.ts` after F-002 ships
- **THEN** the `source` column declaration MUST read `text("source", { enum: ["user", "opencode"] }).notNull()`

#### Scenario: Legacy annotation rows are migrated

- **WHEN** the new Drizzle migration runs against a database that contains rows with `source = 'claude-code'` or `source = 'codex'`
- **THEN** those rows MUST be updated to `source = 'user'` BEFORE the column constraint is narrowed
- **AND** the migration MUST complete without errors

#### Scenario: MCP tool rejects legacy source

- **WHEN** the MCP tool receives an `annotationSource` parameter of `"claude-code"`
- **THEN** the tool MUST fall through to the agent-annotation-source derivation path
- **AND** that path MUST produce `"opencode"` for OpenCode-spawned spans

### Requirement: Span normalization SHALL NOT register the Claude Agent SDK adapter

The span-normalization dispatcher in `src/spans/normalize.ts` SHALL NOT import or register `claudeAgentSdkLlmAdapter`. The file `src/spans/adapters/claude-agent-sdk.ts` SHALL NOT exist on disk after F-002 ships.

#### Scenario: Adapter file is gone

- **WHEN** a contributor lists `src/spans/adapters/`
- **THEN** the directory MUST NOT contain `claude-agent-sdk.ts`

#### Scenario: Normalizer has no Claude registration

- **WHEN** a contributor reads the `ADAPTERS` array in `src/spans/normalize.ts`
- **THEN** the array MUST NOT include any entry whose `name` field contains the substring `claude`

### Requirement: Daemon SHALL NOT ship Codex/Claude/Anthropic source modules

The files `src/codex-cli-chat.ts`, `src/codex-sessions.ts`, `src/claude-cli-chat.ts`, `src/claude-sessions.ts`, `src/claude-ask-user-question.ts`, and `src/spans/adapters/claude-agent-sdk.ts` SHALL NOT exist on disk after F-002 ships. The directories `examples/claude-agent-sdk/` and `examples/anthropic-chat/` SHALL NOT exist on disk after F-002 ships.

#### Scenario: Codex/Claude src files absent

- **WHEN** a contributor lists `src/`
- **THEN** the listing MUST NOT contain `codex-cli-chat.ts`, `codex-sessions.ts`, `claude-cli-chat.ts`, `claude-sessions.ts`, or `claude-ask-user-question.ts`

#### Scenario: Anthropic/Claude example directories absent

- **WHEN** a contributor lists `examples/`
- **THEN** the listing MUST NOT contain `claude-agent-sdk/` or `anthropic-chat/`

### Requirement: package.json SHALL NOT declare Anthropic or Claude Agent SDK dependencies

The `dependencies` object in `package.json` SHALL NOT contain entries keyed `@ai-sdk/anthropic` or `@raindrop-ai/claude-agent-sdk`. The `minimumReleaseAgeExcludes` array in `bunfig.toml` SHALL NOT contain `"@raindrop-ai/claude-agent-sdk"`.

#### Scenario: package.json has no removed deps

- **WHEN** a contributor reads `package.json`
- **THEN** the `dependencies` object MUST NOT contain keys `@ai-sdk/anthropic` or `@raindrop-ai/claude-agent-sdk`

#### Scenario: bunfig.toml has no removed excludes

- **WHEN** a contributor reads `bunfig.toml`
- **THEN** the `minimumReleaseAgeExcludes` array MUST NOT contain the string `"@raindrop-ai/claude-agent-sdk"`

### Requirement: Demo and seed traces SHALL NOT reference claude/anthropic/codex

The files `src/demo-traces.ts` and `scripts/seed-traces.ts` SHALL NOT contain the literal strings `"claude-"`, `"anthropic"`, or `"codex"` in any `model`, `provider`, or `ai.model.provider` field after F-002 ships.

#### Scenario: Demo traces use OpenCode values

- **WHEN** a contributor reads `src/demo-traces.ts`
- **THEN** no `model` field MUST equal `"claude-sonnet-4-5"`
- **AND** no `provider` field MUST equal `"anthropic"`

#### Scenario: Seed traces use OpenCode values

- **WHEN** a contributor reads `scripts/seed-traces.ts`
- **THEN** the `ai.model.id` value at line 77 MUST NOT be `"claude-sonnet-4-5"`
- **AND** the `ai.model.provider` value at line 78 MUST NOT be `"anthropic"`

### Requirement: Provider options SHALL NOT carry Anthropic-specific defaults

The module `src/provider-options.ts` SHALL NOT export an `anthropic()` branch. The functions `detectProvider`, `getProviderBaseURL`, and `getProviderHeaders` SHALL NOT default to Anthropic-shaped URLs or headers for unknown model names. The `secret-store.ts` `SECRET_DEFS` map SHALL NOT contain an `anthropic` entry.

#### Scenario: Provider options module has no anthropic branch

- **WHEN** a contributor searches `src/provider-options.ts` for the substring `anthropic`
- **THEN** no matches MUST be returned (excluding in-code comments describing why the branch was removed, if any)

#### Scenario: Secret store has no anthropic entry

- **WHEN** a contributor reads `src/secret-store.ts`
- **THEN** the `SECRET_DEFS` object MUST NOT contain a key `anthropic`

### Requirement: Final grep sweep SHALL return only allowlisted matches

After F-002 ships, the command `grep -rni "codex\|claude\|anthropic" src/ scripts/ examples/ bin/ package.json bunfig.toml eslint.config.mjs` MUST return only the explicitly-allowed occurrences documented in the proposal's "Scope OUT" section: the `.claude/**` lint ignore in `eslint.config.mjs:39`, the generic AI SDK adapter comments in `src/spans/adapters/ai-sdk.ts`, the generic example apps in `examples/ai-sdk-chat/`, `examples/openai-chat/`, `examples/pi-agent-chat/`, `examples/ai-sdk-otelv2/`, `examples/opencode-plugin-chat/`, and the single informational `ANTHROPIC_API_KEY` mention in `examples/opencode-plugin-chat/server.ts:216`.

#### Scenario: Grep sweep returns only allowlisted matches

- **WHEN** a contributor runs `grep -rni "codex\|claude\|anthropic" src/ scripts/ examples/ bin/ package.json bunfig.toml eslint.config.mjs`
- **THEN** every match MUST be one of the entries listed in the proposal's "Scope OUT" section
