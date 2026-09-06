import { describe, expect, test } from "bun:test";

const dbPath = `/tmp/f008-search-${process.pid}.db`;
process.env.RAINDROP_WORKSHOP_DB_PATH = dbPath;
const { getDrizzleDb, insertSpan, searchSpans } = await import("../src/db");

const db = getDrizzleDb();
db.$client.run("INSERT INTO runs (id,started_at,last_updated_at,convo_id) VALUES (?, ?, ?, ?)", "search-run", 1, 1, "search-convo");
insertSpan({ id: "search-span", run_id: "search-run", name: "think_think", span_type: "TOOL_CALL", model: "MiniMax-M3", status: "OK", input_payload: "Connection refused", output_payload: "HTTP 500", start_time_ms: 1, end_time_ms: 2, duration_ms: 1 });

describe("searchSpans", () => {
  test("returns matching FTS rows with snippets", () => {
    const result = searchSpans("connection");
    expect(result.total).toBe(1);
    expect(result.results[0].span_id).toBe("search-span");
    expect(String((result.results[0] as { snippet: unknown }).snippet).toLowerCase()).toContain("&lt;mark&gt;connection&lt;/mark&gt;");
  });

  test("supports pagination", () => {
    expect(searchSpans("connection", 1, 1).results).toHaveLength(0);
  });

  test("empty query returns no matches", () => {
    expect(searchSpans("   ").total).toBe(0);
  });
});
