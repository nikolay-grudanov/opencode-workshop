## ADDED Requirements

### Requirement: Module map of src/

The `ai-docs/ARCHITECTURE.md` document SHALL contain a table or diagram listing every top-level module under `src/` with: directory/file path, single-line responsibility, key exports, and upstream-vs-fork ownership tag.

The modules that MUST be covered: `src/index.ts` (CLI entry), `src/server.ts` (HTTP+WS daemon), `src/db/` (SQLite + Drizzle), `src/spans/` (normalize, adapters), `src/spans/normalize.ts`, `src/spans/adapters/`, `src/agents.ts` (sub-agent detection), `src/replay.ts`, `src/parse.ts`, `src/otlp-protobuf.ts`, plus fork-only additions vs upstream.

#### Scenario: Reader needs to locate the OTLP ingest handler

- **WHEN** a contributor opens `ai-docs/ARCHITECTURE.md` looking for "where does an incoming trace span enter the system"
- **THEN** the module map points them to `src/parse.ts` (ingest) → `src/otlp-protobuf.ts` (decode) → `src/spans/normalize.ts` (typed shape), with one-line descriptions of each

#### Scenario: Reader needs to identify upstream-vs-fork ownership

- **WHEN** a contributor is deciding whether a file change requires a rebase against `raindrop-ai/workshop`
- **THEN** the module map tags each entry as `upstream`, `fork-only`, or `fork-modified`, so the contributor knows whether upstream also owns the file

### Requirement: End-to-end data flow section

The document SHALL contain a "Data flow" section that traces a single span from plugin emit to UI render, listing every transformation step and the file that performs it. The trace MUST cover: plugin emits OTLP → daemon ingest → protobuf decode → normalize to `NormalizedSpan` → SQLite insert → WebSocket broadcast → React UI render.

#### Scenario: Reader needs to debug why a span did not appear in the UI

- **WHEN** a contributor is debugging a missing-span bug and reads the data flow section
- **THEN** they can identify which step (ingest, decode, normalize, DB, WS, render) is the candidate failure point, with the corresponding file path to inspect

### Requirement: Upstream-vs-fork boundary section

The document SHALL contain a section explaining which directories are upstream-owned (never edited in the fork unless explicitly overridden) and which are fork-only. The list MUST include: `AGENTS.md` (root), `docs/`, `LICENSE`, `bun.lock` as upstream-owned; `ai-docs/`, `openspec/`, `.opencode/`, `.omo/` as fork-only.

#### Scenario: Contributor about to edit an upstream-owned file

- **WHEN** a contributor considers editing `docs/` or the root `AGENTS.md`
- **THEN** the boundary section makes clear those files are upstream-owned and edits require an explicit override from the user

### Requirement: Citation of source anchors

Every module entry, data-flow step, and boundary rule in the document SHALL cite a concrete file path (and line range where stable) so the reader can jump from doc to source without re-searching. Citation format: `` `src/path/to/file.ts` `` or `` `src/path/to/file.ts:LL-LL` ``.

#### Scenario: Reader wants to verify a doc claim against source

- **WHEN** a reader is unsure whether the doc's description of `src/agents.ts` matches the current code
- **THEN** every claim about that file is followed by a path citation, letting the reader open the cited file to verify directly
