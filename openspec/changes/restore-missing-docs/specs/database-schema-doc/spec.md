## ADDED Requirements

### Requirement: Table-by-table schema reference

The `ai-docs/DATABASE.md` document SHALL contain one section per table in the SQLite schema, derived from `src/db/schema.ts`. Each table section MUST list: table name, purpose (one line), every column with name/type/nullable/default, every index, every foreign key or implicit relation, and the Drizzle definition citation (`src/db/schema.ts:LL`).

The tables that MUST be covered: `runs`, `spans`, `annotations`, `saved_events`, `saved_folders`, `live_events`, plus any other table present in `src/db/schema.ts` at the time of writing.

#### Scenario: Contributor writing a query against the DB

- **WHEN** a contributor needs to write a one-off SQLite query against the `spans` table
- **THEN** the schema reference lists every column, type, and relation, so the contributor can write the query without opening `schema.ts`

#### Scenario: Contributor debugging a missing column error

- **WHEN** a contributor gets a "no such column" error from a Drizzle query
- **THEN** the schema reference confirms whether the column exists in the definition, isolating the issue to either a stale migration or a wrong query

### Requirement: Migration workflow section

The document SHALL describe the migration workflow with the exact commands: `bun run db:generate` (generate SQL from schema changes), `bun run db:embed` (embed migrations in the daemon binary), `bun run db:migrate` (apply at runtime). It MUST explain when each command is run (dev vs release), where generated SQL files live (`drizzle/` output dir), and how the daemon applies migrations on startup.

#### Scenario: Contributor adding a new column

- **WHEN** a contributor adds a column to `src/db/schema.ts`
- **THEN** the workflow section tells them to run `bun run db:generate`, commit the generated SQL under `drizzle/`, and verify `bun run db:embed` succeeds, so the change survives a daemon restart

### Requirement: DB path and env var reference

The document SHALL document the SQLite file location (`~/.raindrop/raindrop_workshop.db` by default), the env var that overrides it (`RAINDROP_WORKSHOP_DB_PATH`), and the implications of changing it (existing traces do not migrate). It MUST include the relevant snippet from `package.json` and `drizzle.config.ts`.

#### Scenario: User running out of disk on home volume

- **WHEN** a user wants the SQLite file on a different volume
- **THEN** the env var reference lets them set `RAINDROP_WORKSHOP_DB_PATH=/other/path.db` before starting the daemon, with the caveat that existing data does not auto-migrate

### Requirement: ER diagram or relations description

The document SHALL include either a Mermaid ER diagram or a textual relations description showing how `runs` ↔ `spans` ↔ `annotations` ↔ `saved_events` connect (by `run_id`, `span_id`, etc.). The diagram MUST be renderable on GitHub markdown (Mermaid fenced block) without external tools.

#### Scenario: Reader visualizing the data model

- **WHEN** a reader wants a bird's-eye view of how tables connect
- **THEN** the ER diagram renders inline on GitHub, showing `runs` 1—* `spans`, `spans` 1—* `annotations`, etc., without requiring a separate tool

### Requirement: Backup, reset, and inspection recipes

The document SHALL include a "Operations" section with copy-paste recipes for: backing up the SQLite file, resetting the DB (`raindrop workshop reset` or `rm` of the file), inspecting it with `sqlite3` CLI (open, list tables, dump a row by id). Each recipe MUST be a fenced code block with a one-line purpose.

#### Scenario: User wanting to wipe test data

- **WHEN** a user wants a fresh DB after testing
- **THEN** the operations section provides the reset command and warns that the operation is destructive, so they do it deliberately
