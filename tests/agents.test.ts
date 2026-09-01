/**
 * Tests for src/agents.ts — sub-agent detection.
 *
 * Covers the F-003 contract:
 *   - Pattern 1 (classic agentic loop): TOOL > LLM > TOOL
 *   - Pattern 2 (named agent span):    LLM child named "agent.subagent"
 *   - Pattern 3 (OpenCode task tool):  bare tool call whose name is "task"
 *   - subagent_name attribute (plugin-side metadata) becomes the SubAgent name
 *
 * These tests pin the attribute key the plugin writes to, so the plugin
 * (opencode-workshop-plugin fork) and this repo stay in sync.
 */

import { describe, expect, test } from "bun:test";
import { detectSubAgents, type SubAgent } from "../src/agents";

// Minimal stand-in for the DB row shape detectSubAgents actually consumes.
type Row = Parameters<typeof detectSubAgents>[0][number];

function span(
  partial: Partial<Row> & { id: string; name: string; span_type: string },
): Row {
  return {
    id: partial.id,
    name: partial.name,
    span_type: partial.span_type,
    parent_span_id: partial.parent_span_id ?? null,
    start_time_ms: partial.start_time_ms ?? 0,
    end_time_ms: partial.end_time_ms ?? 100,
    duration_ms: partial.duration_ms ?? 100,
    model: partial.model ?? null,
    status: partial.status ?? "OK",
    input_tokens: partial.input_tokens ?? null,
    output_tokens: partial.output_tokens ?? null,
    attributes: partial.attributes ?? null,
  };
}

function attrsJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

describe("detectSubAgents", () => {
  test("Pattern 1: classic agentic loop TOOL > LLM > TOOL is detected", () => {
    const spans: Row[] = [
      span({ id: "t", name: "task", span_type: "TOOL_CALL", start_time_ms: 0, end_time_ms: 500 }),
      span({ id: "l", name: "llm.generate", span_type: "LLM_GENERATION", parent_span_id: "t", start_time_ms: 10, end_time_ms: 400, model: "gpt-x" }),
      span({ id: "g", name: "read_file", span_type: "TOOL_CALL", parent_span_id: "l", start_time_ms: 50, end_time_ms: 200 }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(1);
    expect(agents[0].root_span_id).toBe("t");
    expect(agents[0].llm_count).toBe(1);
    expect(agents[0].tool_count).toBe(1);
    expect(agents[0].model).toBe("gpt-x");
  });

  test("Pattern 3: bare task tool (no LLM child yet) is detected", () => {
    const spans: Row[] = [
      span({ id: "t", name: "task", span_type: "TOOL_CALL", start_time_ms: 0, end_time_ms: 100 }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(1);
    expect(agents[0].root_span_id).toBe("t");
    expect(agents[0].name).toBe("task");
    expect(agents[0].subagent_name).toBeUndefined();
  });

  test("non-task tool without LLM child is NOT detected", () => {
    const spans: Row[] = [
      span({ id: "r", name: "read_file", span_type: "TOOL_CALL", start_time_ms: 0, end_time_ms: 100 }),
    ];
    expect(detectSubAgents(spans)).toHaveLength(0);
  });

  test("subagent_name attribute on the tool span becomes the display name", () => {
    const spans: Row[] = [
      span({
        id: "t",
        name: "task",
        span_type: "TOOL_CALL",
        start_time_ms: 0,
        end_time_ms: 100,
        attributes: attrsJson({ subagent_name: "code-reviewer" }),
      }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(1);
    expect(agents[0].subagent_name).toBe("code-reviewer");
    expect(agents[0].name).toBe("code-reviewer"); // precedence: subagent_name > span.name
  });

  test("subagent_name attribute on the LLM child (plugin contract) is picked up", () => {
    const spans: Row[] = [
      span({ id: "t", name: "task", span_type: "TOOL_CALL", start_time_ms: 0, end_time_ms: 500 }),
      span({
        id: "l",
        name: "llm.generate",
        span_type: "LLM_GENERATION",
        parent_span_id: "t",
        start_time_ms: 10,
        end_time_ms: 400,
        attributes: attrsJson({ subagent_name: "lint-checker" }),
      }),
      span({ id: "g", name: "read_file", span_type: "TOOL_CALL", parent_span_id: "l", start_time_ms: 50, end_time_ms: 200 }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(1);
    expect(agents[0].subagent_name).toBe("lint-checker");
    expect(agents[0].name).toBe("lint-checker");
  });

  test("LLM child name 'agent.subagent' triggers detection (Pattern 2)", () => {
    const spans: Row[] = [
      span({ id: "t", name: "codex", span_type: "TOOL_CALL", start_time_ms: 0, end_time_ms: 500 }),
      span({ id: "l", name: "agent.subagent", span_type: "LLM_GENERATION", parent_span_id: "t", start_time_ms: 10, end_time_ms: 400 }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(1);
    expect(agents[0].root_span_id).toBe("t");
  });

  test("malformed attributes JSON is tolerated (no crash)", () => {
    const spans: Row[] = [
      span({
        id: "t",
        name: "task",
        span_type: "TOOL_CALL",
        start_time_ms: 0,
        end_time_ms: 100,
        attributes: "{not-json",
      }),
    ];
    expect(() => detectSubAgents(spans)).not.toThrow();
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(1);
    expect(agents[0].subagent_name).toBeUndefined();
  });

  test("subagent_name of wrong type is ignored", () => {
    const spans: Row[] = [
      span({
        id: "t",
        name: "task",
        span_type: "TOOL_CALL",
        start_time_ms: 0,
        end_time_ms: 100,
        attributes: attrsJson({ subagent_name: 42 }),
      }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(1);
    expect(agents[0].subagent_name).toBeUndefined();
    expect(agents[0].name).toBe("task");
  });

  test("Pattern 3: subagent_name on bare leaf tool span (no LLM child) is detected", () => {
    // Simulates an OpenCode sub-agent whose plugin attaches `subagent_name`
    // directly to the TOOL_CALL span (e.g. `subagent.audit`, `subagent.docs`),
    // and the leaf has no further tool use.
    const spans: Row[] = [
      span({
        id: "a",
        name: "subagent.audit",
        span_type: "TOOL_CALL",
        start_time_ms: 0,
        end_time_ms: 100,
        attributes: attrsJson({ subagent_name: "security-auditor" }),
      }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(1);
    expect(agents[0].root_span_id).toBe("a");
    expect(agents[0].subagent_name).toBe("security-auditor");
    expect(agents[0].name).toBe("security-auditor");
  });

  test("tool span WITHOUT subagent_name and without LLM child is NOT a sub-agent", () => {
    // Sanity: a regular `bash` tool call must not be classified as a sub-agent
    // even if its name happens to start with 'subagent.'. The discriminator
    // is the plugin-side `subagent_name` attribute (or Pattern 1 agentic loop).
    const spans: Row[] = [
      span({ id: "x", name: "bash", span_type: "TOOL_CALL", start_time_ms: 0, end_time_ms: 100 }),
    ];
    expect(detectSubAgents(spans)).toHaveLength(0);
  });

  test("Parallel siblings: 3 tool spans with subagent_name attrs at same level are all detected", () => {
    const spans: Row[] = [
      span({ id: "rt", name: "agent.turn", span_type: "INTERNAL", start_time_ms: 0, end_time_ms: 3000 }),
      span({
        id: "w",
        name: "subagent.test",
        span_type: "TOOL_CALL",
        parent_span_id: "rt",
        start_time_ms: 100,
        end_time_ms: 2000,
        attributes: attrsJson({ subagent_name: "test-writer" }),
      }),
      span({
        id: "s",
        name: "subagent.audit",
        span_type: "TOOL_CALL",
        parent_span_id: "rt",
        start_time_ms: 100,
        end_time_ms: 1800,
        attributes: attrsJson({ subagent_name: "security-auditor" }),
      }),
      span({
        id: "d",
        name: "subagent.docs",
        span_type: "TOOL_CALL",
        parent_span_id: "rt",
        start_time_ms: 100,
        end_time_ms: 1500,
        attributes: attrsJson({ subagent_name: "doc-updater" }),
      }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(3);
    const names = agents.map(a => a.subagent_name).sort();
    expect(names).toEqual(["doc-updater", "security-auditor", "test-writer"]);
  });

  test("3-level nesting: agent > agent > agent (each with subagent_name) all detected", () => {
    const spans: Row[] = [
      span({ id: "rt", name: "agent.turn", span_type: "INTERNAL", start_time_ms: 0, end_time_ms: 4000 }),
      span({
        id: "w",
        name: "subagent.test",
        span_type: "TOOL_CALL",
        parent_span_id: "rt",
        start_time_ms: 100,
        end_time_ms: 3000,
        attributes: attrsJson({ subagent_name: "test-writer" }),
      }),
      span({
        id: "wc",
        name: "subagent.coverage",
        span_type: "TOOL_CALL",
        parent_span_id: "w",
        start_time_ms: 1500,
        end_time_ms: 2900,
        attributes: attrsJson({ subagent_name: "coverage-reporter" }),
      }),
      span({
        id: "cl",
        name: "subagent.lcov",
        span_type: "TOOL_CALL",
        parent_span_id: "wc",
        start_time_ms: 2000,
        end_time_ms: 2800,
        attributes: attrsJson({ subagent_name: "lcov-parser" }),
      }),
    ];
    const agents = detectSubAgents(spans);
    expect(agents).toHaveLength(3);
    expect(agents.find(a => a.root_span_id === "w")?.subagent_name).toBe("test-writer");
    expect(agents.find(a => a.root_span_id === "wc")?.subagent_name).toBe("coverage-reporter");
    expect(agents.find(a => a.root_span_id === "cl")?.subagent_name).toBe("lcov-parser");
  });

  test("empty spans list returns empty array", () => {
    expect(detectSubAgents([])).toEqual<SubAgent[]>([]);
  });
});
