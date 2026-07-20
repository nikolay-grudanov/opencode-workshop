## ADDED Requirements

### Requirement: No OAuth or write-key storage remains

After this change, the fork SHALL NOT store, transmit, or read OAuth tokens or Raindrop write keys. The files `src/auth/oauth.ts`, `src/auth/login.ts`, `src/auth/write-key.ts`, `src/auth/token-store.ts`, and `src/auth/constants.ts` SHALL NOT exist. No file under `src/` SHALL reference `oauth`, `writeKey`, `write_key`, `RAINDROP_WRITE_KEY`, or `RAINDROP_TOKEN` after the change.

#### Scenario: No OAuth flow reachable

- **WHEN** a contributor runs `grep -rn "oauth\\|OAuth\\|writeKey\\|write_key\\|RAINDROP_WRITE_KEY\\|RAINDROP_TOKEN\\|cmdLogin\\|cmdLogout\\|token-store" src/`
- **THEN** the command returns zero matches

#### Scenario: Daemon starts without ~/.raindrop credentials

- **WHEN** a contributor with an empty `~/.raindrop/` directory starts the daemon via `bun run dev` after this change
- **THEN** the daemon starts successfully without reading or prompting for any credential file, proving the local stack is credentials-free

### Requirement: Local-first auth model is documented in API.md

The companion docs change (`restore-missing-docs`) covers this in API.md's "Auth and config" section, so this change SHALL NOT independently document auth — it SHALL only ensure the source-code reality (no auth code) matches what API.md will eventually document. The two changes are coordinated: F-001 ships the code state, `restore-missing-docs` ships the doc state.

#### Scenario: Doc and code stay in sync

- **WHEN** both `restore-missing-docs` and `remove-cloud-integration-f001` have been applied
- **THEN** API.md's auth section says "no auth (local-only)" and the source has zero auth-related code, so the doc is truthful
