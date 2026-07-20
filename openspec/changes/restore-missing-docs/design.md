## Context

This fork (`ai-docs/AGENTS.md:10-23`) is the local-only debugger variant of `raindrop-ai/workshop`. The fork already has process docs — `ai-docs/PLAN.md` (features), `ai-docs/HANDOFF.md` (session state), `ai-docs/AGENTS.md` (conventions) — but **zero technical reference docs**. Every agent or contributor picking up a Feature must re-read 2550 LOC of `src/server.ts` to find an endpoint, or re-discover the SQLite schema by opening `src/db/schema.ts`.

The previous planning attempt (`.omo/drafts/docs-and-cloud-removal.md`) collapsed under its own review complexity (Metis + Momus + Oracle dual review, `pending-action: write and review .omo/plans/...`). This change is the OpenSpec re-formulation: focused scope, single deliverable type (Markdown files), no review-loop ceremony.

Constraints inherited from the fork (`ai-docs/AGENTS.md:55-59`):
- `docs/` at repo root is **upstream-owned** — do not edit.
- Repo-root `AGENTS.md` is **upstream-owned** — do not edit.
- Fork docs live in `ai-docs/`.

## Goals / Non-Goals

**Goals:**
- Deliver 5 technical reference docs that let any reader answer "where is X?", "what does the API expose?", "what does the plugin need to send?", "what's the DB shape?", "how do I run this?" without opening source.
- Each doc cites concrete file paths and line ranges so it is verifiable, not authoritative-by-fiat.
- Update `ai-docs/AGENTS.md` Quick Reference to link the new docs — single source of entry.
- Stay structurally compatible with OpenSpec so future changes (e.g. `remove-cloud-integration-f001`) can reference these docs as anchors.

**Non-Goals:**
- ❌ No source code changes of any kind (no `src/`, `app/`, `bin/`, `scripts/`, `examples/`).
- ❌ No dependency changes (`package.json`, `bun.lock` untouched).
- ❌ No new `tests/` directory or test scaffolding (the missing-`tests/` gap is documented in DEVELOPMENT.md as a known issue for a future change).
- ❌ No CONTRIBUTING.md (the fork uses `ai-docs/AGENTS.md` for that role).
- ❌ No F-001..F-005 code work — separate changes.
- ❌ No doc consolidation with upstream (`docs/` is upstream-owned).
- ❌ No migration of existing process docs (PLAN.md, HANDOFF.md stay as-is).

## Decisions

### D1 — Docs live in `ai-docs/`, not `docs/`  *(load-bearing)*

**Decision:** All five new files are created under `ai-docs/`. The `docs/` directory is left untouched.

**Rationale:** `ai-docs/AGENTS.md:55-59` explicitly marks `docs/` as upstream-owned. The fork has already established `ai-docs/` as its doc space (PLAN.md, HANDOFF.md, AGENTS.md, reference/). Mixing fork docs into `docs/` would force a rebase conflict on the next upstream sync.

**Alternatives considered:**
- _Create a `docs/fork/` subdir_ — rejected: still inside upstream-owned `docs/`, conflict-prone, and breaks the existing convention.
- _Co-locate each doc next to the code it describes (e.g. `src/ARCHITECTURE.md`)_ — rejected: clutters `src/`, conflicts with the fork's "src is for code" model, and makes discoverability worse.

**Reversibility:** Trivially reversible (move files).

### D2 — Five docs, no more, no fewer  *(reversible)*

**Decision:** Exactly five new docs: ARCHITECTURE, API, PLUGIN-CONTRACT, DATABASE, DEVELOPMENT. No CONTRIBUTING, no TESTING (doesn't exist), no CHANGELOG (git log), no SECURITY (not applicable for local-only daemon).

**Rationale:** These five are the standard technical-reference set a TypeScript daemon+UI project of this complexity needs. The fork's process docs (PLAN/HANDOFF/AGENTS) already cover workflow. CONTRIBUTING is `ai-docs/AGENTS.md`'s role.

**Alternatives considered:**
- _Add CONTRIBUTING.md_ — rejected: redundant with `ai-docs/AGENTS.md`.
- _Add a CHANGELOG.md_ — rejected: `git log` + `ai-docs/PLAN.md` "Closed Features" section already serve this purpose.

**Reversibility:** Trivially reversible (delete a doc).

### D3 — Citation format: `` `path:LL` `` or `` `path:LL-LL` ``  *(reversible)*

**Decision:** Every doc claim about source code is followed by a path citation in backticks. Single-statement claims use `file.ts:LL`; multi-line claims use `file.ts:LL-LL`. Citations are inline in prose, not in footnotes.

**Rationale:** Lets reviewers verify accuracy without re-searching. Matches the style already used in `.omo/drafts/docs-and-cloud-removal.md` and `ai-docs/HANDOFF.md`.

**Alternatives considered:**
- _Footnote-style `[^1]`_ — rejected: harder to read in raw markdown, harder to maintain.
- _No citations, "trust the doc"_ — rejected: docs rot silently without verification anchors.

**Reversibility:** Re-style is a find-replace.

### D4 — Doc structure: capability-spec sections become doc sections  *(reversible)*

**Decision:** Each doc's top-level sections are derived from the requirements in its capability spec (`openspec/changes/restore-missing-docs/specs/<doc>/spec.md`). E.g. ARCHITECTURE.md has sections "Module map of src/", "Data flow", "Upstream-vs-fork boundary", "Citation of source anchors" — matching `specs/architecture-doc/spec.md`.

**Rationale:** Bidirectional traceability — a reader can jump between spec ("the doc must do X") and doc ("here is X") without translation.

**Alternatives considered:**
- _Free-form structure per doc author_ — rejected: invites drift between spec and doc; defeats the point of writing specs first.

**Reversibility:** Doc section headings can be re-organized without changing content.

### D5 — Doc writing order: ARCHITECTURE → API → DATABASE → PLUGIN-CONTRACT → DEVELOPMENT  *(reversible)*

**Decision:** Write in this order because each doc cross-references the previous:
1. ARCHITECTURE establishes module names → API uses them for handler locations
2. API exhaustively lists endpoints → DATABASE references those that touch the DB
3. DATABASE tables documented → PLUGIN-CONTRACT references the ingest endpoint (from API) and span shape (from DATABASE's `spans` table)
4. PLUGIN-CONTRACT relies on ingest + span shape from API/ARCHITECTURE
5. DEVELOPMENT ties everything together for the dev experience

**Rationale:** Each doc's anchors are established by the time it is written, reducing rework.

**Alternatives considered:**
- _Random order / parallel writing_ — rejected: high risk of inconsistency; docs would need a reconciliation pass.

**Reversibility:** Reordering only affects writing sequence, not final state.

### D6 — AGENTS.md Quick Reference update is a single commit, not per-doc  *(load-bearing)*

**Decision:** The five-row update to `ai-docs/AGENTS.md`'s Quick Reference table happens in the **same commit as the first doc** (ARCHITECTURE.md), with rows for the other four docs pointing at files that will exist by end-of-change. Alternatively, the update can be batched into a final "docs: complete reference set" commit. The choice is left to the worker but MUST NOT be split across five commits.

**Rationale:** Avoids five noisy commits touching the same file; avoids dead links in intermediate commits.

**Alternatives considered:**
- _One commit per doc, each touching AGENTS.md_ — rejected: violates Kolya's "one Feature = one commit" style; this whole change is one logical unit (the docs Feature).

**Reversibility:** Re-style is a single edit.

### D7 — No F-NNN ID assignment for this change  *(load-bearing)*

**Decision:** This docs-restoration change is **not** added to `ai-docs/PLAN.md` as a new F-NNN entry. It exists purely as an OpenSpec change.

**Rationale:** PLAN.md F-NNN numbers are reserved for code features (F-001..F-005 + backlog F-006..F-010 are all code). A docs-only addition does not fit the F-NNN model. The fork's AGENTS.md "Quick reference" table (updated by D6) becomes the index for these docs instead.

**Alternatives considered:**
- _Assign F-011 to docs restoration_ — rejected: inflates F-NNN with non-code entries; future code features would inherit confusing numbering.

**Reversibility:** If the user prefers, a future PLAN.md update can backfill an F-NNN entry.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **Docs rot** as the codebase evolves (especially after F-001, F-002 land) | Every doc section cites specific `path:LL` anchors; on any code touch, the worker re-checks anchors. DEVELOPMENT.md documents this rule explicitly. |
| **Anchors break** if line ranges shift between writing the doc and a future PR | Citation format is human-readable (`path:LL-LL`), not link-clickable — readers land on the right file and search for the symbol. Spec includes a "verify-on-touch" rule. |
| **API.md becomes a 2550-LOC dump** if it lists every route verbatim from `src/server.ts` | Spec caps each route entry at: method, path, query, request body shape (or "none"), response shape, status codes, one-line example, one-line description. Prose stays concise. |
| **PLUGIN-CONTRACT.md accuracy depends on plugin repo** (`~/workspase/projects/opencode-workshop-plugin/`) the worker cannot edit | Plugin contract spec only requires documenting what the **daemon** expects; plugin-side implementation is referenced but not described. Worker verifies the daemon side against `src/parse.ts` + `src/spans/normalize.ts`. |
| **DATABASE.md ER diagram fails to render on GitHub** if Mermaid syntax is wrong | Worker pastes the Mermaid block into a GitHub render preview (or runs `bun x markdown-preview` / equivalent) before commit. Fallback: textual relations description is also included per spec. |
| **Reviewer expects Metis/Momus/Oracle review** (the trap that stalled the previous attempt) | This change is doc-only, structurally verifiable (files exist, sections present, citations resolve). The worker self-verifies via the per-task checklist; no external review loop is required for delivery. User can request post-hoc review if desired. |
| **DEVELOPMENT.md duplicates upstream AGENTS.md content** | Spec requires DEVELOPMENT.md to go *deeper* than upstream AGENTS.md (env vars full table, dev vs dev:server vs dev:ui distinction, the no-tests-dir gap). Upstream's "use `raindrop workshop start`" stays upstream; DEVELOPMENT.md is the `bun run dev` experience. |
| **Existing process docs reference `app.raindrop.ai`** (e.g. ai-docs/AGENTS.md mentions cloud removal) | Not in scope for this change. Those references become stale after F-001 lands; F-001's tasks include a sweep of `ai-docs/` for cloud mentions. |

## Migration Plan

Not applicable — this change is additive (new doc files only, one minimal edit to `ai-docs/AGENTS.md` Quick Reference). No state migration, no schema change, no runtime behavior change.

**Rollback:** `git revert <commit>` removes the docs and the AGENTS.md table update. No residual state.

## Open Questions

None. All fork-constraint questions are resolved by `ai-docs/AGENTS.md` and `ai-docs/HANDOFF.md`. All doc-content questions are resolved by the capability specs. Worker proceeds when artifacts are written.
