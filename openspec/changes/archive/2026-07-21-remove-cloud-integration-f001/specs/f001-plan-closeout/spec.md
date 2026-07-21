## ADDED Requirements

### Requirement: PLAN.md F-001 entry closed

After this change, `ai-docs/PLAN.md` SHALL reflect F-001 as closed:
- All F-001 checkboxes (currently `ai-docs/PLAN.md:213-223`) SHALL be `[x]`.
- The F-001 entry SHALL be removed from "## Active Features" and re-posted under "## Closed Features" (currently `ai-docs/PLAN.md:237-239`) with a `Closed YYYY-MM-DD` note matching the commit-5 date.
- The "_(none yet — F-001 will land here once all todos are checked)_" placeholder (currently L239) SHALL be removed.

#### Scenario: PLAN.md grep for open F-001 todos returns zero

- **WHEN** a contributor runs `grep -nE "^- \\[ \\]" ai-docs/PLAN.md | grep -A0 -B5 "F-001"` (or equivalent check that F-001 has no pending checkboxes)
- **THEN** no open checkbox lines appear under the F-001 entry

#### Scenario: Closed Features section has F-001 entry

- **WHEN** a contributor reads the "## Closed Features" section of `ai-docs/PLAN.md` after the change
- **THEN** they find an "### F-001 — Remove all Cloud Raindrop integration" subsection with a closing date and a one-line summary like "Closed YYYY-MM-DD: cloud SaaS surface removed in 5 commits; grep sweep clean; smoke test passed."

### Requirement: Commit history shows exactly five commits for F-001

The git log for F-001 SHALL contain exactly five commits matching the design's commit decomposition (C1: cloud dir, C2: auth dir, C3: install/README, C4: deps, C5: sweep + closeout). Each commit message SHALL follow conventional-commit format (`feat:`, `chore:`, `refactor:`, `docs:`) and SHALL include `Refs F-001.` in the body.

#### Scenario: git log filtered to F-001 shows five commits

- **WHEN** a contributor runs `git log --grep="F-001" --oneline` after the change
- **THEN** exactly five commits are listed, in order: cloud-dir removal, auth-dir removal, install/README cleanup, deps audit, sweep + PLAN.md closeout

#### Scenario: Each F-001 commit is independently buildable

- **WHEN** a contributor checks out any of the five F-001 commits in isolation
- **THEN** `bun run build` succeeds at that commit (no intermediate commit leaves the build broken) — this is the per-commit verification bar
