import { describe, expect, test } from "bun:test";

const dbPath = `/tmp/f008-search-${process.pid}.db`;
process.env.RAINDROP_WORKSHOP_DB_PATH = dbPath;
const { getDrizzleDb, insertSpan, searchSpans } = await import("../src/db");

const db = getDrizzleDb();
db.$client.run("INSERT INTO runs (id,started_at,last_updated_at,convo_id) VALUES (?, ?, ?, ?)", ["search-run", 1, 1, "search-convo"]);
insertSpan({ id: "search-span", run_id: "search-run", name: "think_think", span_type: "TOOL_CALL", model: "MiniMax-M3", status: "OK", input_payload: "Connection refused", output_payload: "HTTP 500", start_time_ms: 1, end_time_ms: 2, duration_ms: 1 });

describe("searchSpans", () => {
  test("returns matching FTS rows with snippets", () => {
    const result = searchSpans("connection");
    expect(result.total).toBe(1);
    expect(result.results[0].span_id).toBe("search-span");
    expect(String((result.results[0] as { snippet: unknown }).snippet).toLowerCase()).toContain("&lt;mark&gt;connection&lt;/mark&gt;");
  });

  test("supports pagination", () => {
    expect(searchSpans("connection", { limit: 1, offset: 1 }).results).toHaveLength(0);
  });

  test("empty query returns no matches", () => {
    expect(searchSpans("   ").total).toBe(0);
  });
});

describe("searchSpans filters", () => {
  test("filters by agent event_name", () => {
    db.$client.run("UPDATE runs SET event_name = ? WHERE id = ?", ["code-agent", "search-run"]);
    db.$client.run("INSERT INTO runs (id,started_at,last_updated_at,convo_id,event_name) VALUES (?, ?, ?, ?, ?)", ["other-run", 1, 1, "other", "diagram-agent"]);
    db.$client.run(`INSERT INTO spans_fts (span_id, run_id, convo_id, span_name, span_type, model, content_text) VALUES ('other-span','other-run','other','llm.generate','LLM_GENERATION','MiniMax-M3','hydration test')`);
    const result = searchSpans("hydration", { agent: "code-agent" });
    expect(result.total).toBe(0);
    const matched = searchSpans("connection", { agent: "code-agent" });
    expect(matched.total).toBe(1);
  });

  test("filters by git project/branch/commit", () => {
    db.$client.run("UPDATE runs SET metadata = ? WHERE id = ?", [JSON.stringify({ git: { project: "opencode-workshop", branch: "main", commit: "abc123" } }), "other-run"]);
    const proj = searchSpans("hydration", { project: "opencode-workshop" });
    expect(proj.total).toBe(1);
    const missing = searchSpans("hydration", { project: "no-such-project" });
    expect(missing.total).toBe(0);
    const commit = searchSpans("hydration", { commit: "abc" });
    expect(commit.total).toBe(1);
  });

  test("returns facets for client-side suggestions", async () => {
    const { computeFacets } = await import("../src/db");
    const facets = computeFacets();
    expect(facets.agents).toContain("code-agent");
    expect(facets.agents).toContain("diagram-agent");
    expect(facets.projects).toContain("opencode-workshop");
    expect(facets.branches).toContain("main");
  });
});
