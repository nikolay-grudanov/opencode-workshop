# Agent guide

Read this first to decide what the user actually wants.

## Did the user ask you to *use* Workshop? (the common case)

If the user wants to install, run, or try Workshop (or get its tracing /
agent-debugging features), **just run the one-liner:**

```bash
curl -fsSL https://raindrop.sh/install | bash
```

That installs the `raindrop` CLI and everything Workshop needs. Then
`raindrop workshop` starts the UI.

Do **not** clone this repository, run `bun install`, or `bun run dev` for this.
Building from source is **not** the way to use Workshop. It is slower, needs a
Bun toolchain, and is only meant for people developing Workshop itself. If you
cloned the repo to "set up Workshop", stop and run the one-liner instead.

**Hosted observability instead of the local debugger?** If the user wants
production monitoring on [app.raindrop.ai](https://app.raindrop.ai) rather than
the local Workshop daemon, connect the project to Raindrop Cloud (no daemon):

```bash
raindrop cloud setup
# or, in one line: curl -fsSL https://raindrop.sh/install | bash -s -- --cloud
```

Only build from source if the user **explicitly** asked to develop, modify, or
contribute to Workshop (e.g. "clone the workshop repo", "build it from source",
"I want to change Workshop's code").

## Did the user ask you to *develop* Workshop?

Then you are in the right place. Build from source:

```bash
bun install
bun run dev   # Workshop daemon + Vite UI on http://localhost:5899
```

Useful commands: `bun run lint`, `bun run test`, `bun x tsc --noEmit`,
`bun run build`. See `.devin/blueprint.yml` and `.cursor/README.md` for the
full dev-environment setup.

## HIGH PRIORITY: research workflow before starting any work

Before doing anything on this codebase, gather context through these channels.
Skip none of them — they exist because raw `Grep`/`Read` over a 180-file monorepo
is wasteful and stale-trained knowledge is wrong on Bun, Vite, React, drizzle,
Hono, etc.

1. **graphify graph** (`graphify-out/`) — the local knowledge graph, the
   cheapest first stop for anything codebase-shaped.
   - **Codebase question?** Run `graphify query "<question>"`. It returns a
     scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep.
   - **Two specific things?** Run `graphify path "<A>" "<B>"`.
   - **Concept focused?** Run `graphify explain "<concept>"`.
   - **Blast radius of a change?** Run `graphify affected "<X>"`.
   - **Broad architecture review** (only when query/path/explain don't suffice):
     read `graphify-out/GRAPH_REPORT.md`.
   - **Navigation across the repo** (only if `graphify-out/wiki/index.md` exists):
     use it instead of raw source browsing.
   - The graph has 1107 nodes / 2302 edges / 60 labeled communities (community
     labels are real names like "OTLP Protobuf Decoder", not "Community N").
   - **Skip graphify only if**: the task is about stale or incorrect graph
     output, or the user explicitly says not to use it. Dirty `graphify-out/`
     after hooks/updates is normal and not a reason to skip.
   - **After modifying code**, run `graphify update .` to keep the graph current
     (AST-only, no API cost).

2. **context7** (MCP) — current library/framework/SDK/API docs.
   - Use for ANY external library question, even well-known ones like React,
     Next.js, Prisma, Express, Tailwind, Django, Spring Boot, Bun, Vite, Hono,
     drizzle, OpenAI/Anthropic SDKs, etc. Training data may be stale.
   - Workflow: `resolve-library-id` → `query-docs`. One topic per query.
   - Skip only for: refactoring, writing scripts from scratch, debugging
     business logic, code review, or general programming concepts.

3. **repomix-mcp** — codebase packing and synthesis.
   - Use for: code reviews, broad architecture analysis, large-repo navigation,
     documentation generation, security audits, and any context-heavy operation
     where consolidating many files into one structured view (XML/JSON/MD) is
     cheaper than reading them individually.
   - Workflow: `pack_codebase` → `grep_repomix_output` (incremental search, not
     full re-read) → `read_repomix_output` for the bits you actually need.

4. **searxng** (MCP) — privacy-respecting web search for current/recent
   information not in context7.
   - Use for: blog posts, GitHub issues, StackOverflow, news, recent CVEs,
     "latest X" / "how to Y in 2026" questions.
   - `searxng_web_search` for the search; `web_url_read` (or `searxng_searxng_web_search`
     suggestions) to fetch the full page when a snippet isn't enough.
   - Prefer `context7` first; fall back to searxng only when context7 has no
     match (private/internal docs, very recent changes, niche tooling).

**Dispatch these in parallel** when possible — graphify query, context7 lookup,
repomix pack, and searxng search are independent reads and the orchestrator can
fire them all at once before synthesizing an answer.

## /graphify slash command

When the user types `/graphify`, use the installed graphify skill or instructions
before doing anything else. (This is the entry point for the high-priority
research workflow above — the skill handles the graphify portion.)
