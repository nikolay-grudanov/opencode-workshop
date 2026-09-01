/**
 * Sub-agent detection from span trees.
 *
 * A sub-agent is detected by one of three patterns:
 *   Pattern 1 (classic agentic loop): TOOL_CALL > LLM_GENERATION > TOOL_CALL
 *   Pattern 2 (named agent span):    any child LLM span named "agent.subagent"
 *   Pattern 3 (OpenCode task tool):  TOOL_CALL with name "task" — OpenCode's
 *                                    built-in delegation tool. The plugin
 *                                    attaches the user-supplied description as
 *                                    `subagent_name` to the LLM child span, so
 *                                    detection still uses Pattern 1 (tool > LLM)
 *                                    when children are present; Pattern 3
 *                                    catches the degenerate case where the
 *                                    child session is still spinning up at
 *                                    snapshot time and no LLM child exists yet.
 *
 * Display name precedence: explicit `subagent_name` attribute (plugin F-003
 * contract) > span.name > "task N" (auto-numbered).
 */

interface SpanRow {
  id: string;
  parent_span_id: string | null;
  name: string;
  span_type: string | null;
  start_time_ms: number;
  end_time_ms: number;
  duration_ms: number;
  model: string | null;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  /** OTLP attributes JSON blob; present on client-side Span[] rows. */
  attributes?: string | null;
}

export interface SubAgent {
  /** The TOOL_CALL span that triggered this sub-agent */
  root_span_id: string;
  /** Name of the tool / agent */
  name: string;
  /** Sub-agent display name from the LLM child's `attributes.subagent_name` (plugin F-010). */
  subagent_name?: string;
  /** All span IDs that belong to this sub-agent (including the root) */
  span_ids: string[];
  start_time_ms: number;
  end_time_ms: number;
  duration_ms: number;
  /** Model used (from the first LLM child) */
  model: string | null;
  status: string;
  llm_count: number;
  tool_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
}

export function detectSubAgents(spans: SpanRow[]): SubAgent[] {
  const children = new Map<string, SpanRow[]>();
  const spanMap = new Map<string, SpanRow>();
  for (const s of spans) {
    spanMap.set(s.id, s);
    if (s.parent_span_id) {
      const kids = children.get(s.parent_span_id) ?? [];
      kids.push(s);
      children.set(s.parent_span_id, kids);
    }
  }

  const agents: SubAgent[] = [];

  // Find TOOL_CALL spans that contain an agentic loop.
  // Detection: either strict parent-child (TOOL > LLM > TOOL),
  // or time-overlap (a TOOL_CALL whose time range contains an LLM span with TOOL children).
  for (const span of spans) {
    if (span.span_type !== "TOOL_CALL") continue;

    // Detect sub-agent patterns:
    // 1. Classic agentic loop: TOOL > LLM > TOOL (tool contains LLM that uses tools)
    // 2. Named sub-agent: TOOL > agent.subagent (Claude Agent SDK pattern — may not have tool children)
    // 3. OpenCode `task` tool OR any tool that carries `subagent_name` attribute:
    //    the plugin attaches `subagent_name` to every delegated sub-agent tool
    //    span in `tool.execute.before`, regardless of the tool's canonical name
    //    (the OpenCode built-in is `task`; Claude Agent SDK uses `subagent.*`;
    //    custom plugins may use other names). Catching all of them keeps the
    //    UI consistent even when a leaf sub-agent has no further children.
    const isTaskTool = span.name === "task";
    const kids = children.get(span.id) ?? [];
    const llmKids = kids.filter(k => k.span_type?.includes("LLM"));
    let hasAgenticLoop = false;
    let subagentName: string | undefined;
    for (const llm of llmKids) {
      // Pattern 1: LLM child has TOOL grandchildren
      const grandkids = children.get(llm.id) ?? [];
      if (grandkids.some(g => g.span_type === "TOOL_CALL")) {
        hasAgenticLoop = true;
      }
      // Pattern 2: LLM child is explicitly named as a sub-agent
      if (llm.name === "agent.subagent") {
        hasAgenticLoop = true;
      }
      // Read subagent_name from the LLM child's attributes (plugin F-003 contract).
      if (!subagentName && llm.attributes) {
        try {
          const attrs = JSON.parse(llm.attributes) as Record<string, unknown>;
          const v = attrs["subagent_name"];
          if (typeof v === "string" && v.length > 0) subagentName = v;
        } catch {}
      }
      if (hasAgenticLoop && subagentName) break;
    }

    // Also read subagent_name directly from the TOOL_CALL span's own attributes
    // (the plugin attaches it there in tool.execute.before before the LLM child
    // is born, so the bare `task` span can carry the human label too).
    let spanHasSubagentAttr = false;
    if (span.attributes) {
      try {
        const attrs = JSON.parse(span.attributes) as Record<string, unknown>;
        const v = attrs["subagent_name"];
        if (typeof v === "string" && v.length > 0) {
          if (!subagentName) subagentName = v;
          spanHasSubagentAttr = true;
        }
      } catch {}
    }

    // Pattern 3 fires when EITHER the tool is the canonical `task` OR the
    // plugin has labelled this tool span as a sub-agent (any tool name, even
    // when no LLM grandchild exists yet — leaf sub-agents without further
    // tool use still need to show up in the tree).
    const isSubAgentByAttribute = spanHasSubagentAttr;
    if (!hasAgenticLoop && !isTaskTool && !isSubAgentByAttribute) continue;

    // Collect all descendant span IDs — by parent-child AND time overlap
    const allSpanIds: string[] = [];
    const collected = new Set<string>();
    let llmCount = 0;
    let toolCount = 0;
    let totalIn = 0;
    let totalOut = 0;
    let model: string | null = null;

    function collect(id: string) {
      if (collected.has(id)) return;
      collected.add(id);
      allSpanIds.push(id);
      const s = spanMap.get(id);
      if (s) {
        if (s.span_type?.includes("LLM")) {
          llmCount++;
          if (!model && s.model) model = s.model;
          if (s.input_tokens) totalIn += s.input_tokens;
          if (s.output_tokens) totalOut += s.output_tokens;
        }
        if (s.span_type === "TOOL_CALL" && s.id !== span.id) toolCount++;
      }
      for (const kid of children.get(id) ?? []) collect(kid.id);
    }
    collect(span.id);

    // Display name: plugin-supplied subagent_name > raw tool name.
    // SpanTree.tsx already does the final "task N" fallback when neither is set.
    agents.push({
      root_span_id: span.id,
      name: subagentName ?? span.name,
      subagent_name: subagentName,
      span_ids: allSpanIds,
      start_time_ms: span.start_time_ms,
      end_time_ms: span.end_time_ms,
      duration_ms: span.duration_ms,
      model,
      status: span.status,
      llm_count: llmCount,
      tool_count: toolCount,
      total_input_tokens: totalIn,
      total_output_tokens: totalOut,
    });
  }

  return agents;
}
