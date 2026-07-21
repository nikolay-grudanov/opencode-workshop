import { useMemo, useState } from "react";
import { C } from "../utils/colors";
import { SPAN_TYPE_COLORS, SPAN_TYPE_LABELS } from "../utils/span-colors";
import { fmt } from "../utils/helpers";
import type { Span, SubAgent } from "../utils/types";
import { Chevron } from "./Icons";

/**
 * F-004.5 — Session Tree tab.
 *
 * Renders the run's sub-agent sessions (F-003 SubAgent shape) as a recursive
 * tree. Sub-agents are intrinsically flat in the data model, but a sub-agent's
 * root span can live inside another sub-agent's `span_ids` set — we use that
 * containment to reconstruct parent/child relationships.
 *
 * Each node shows name, status pill, duration, model + token + tool counts,
 * and a button to dive into that sub-agent's own run view (delegates to the
 * same `onDiveIn(root_span_id)` callback the chat surface uses).
 */

type SessionStatus = "running" | "completed" | "failed";

function statusFromAgent(agent: SubAgent): SessionStatus {
  if (agent.status === "ERROR") return "failed";
  // An agent is "running" while its root span is still open. Once end_time_ms
  // is set (equal to start when first emitted, advances on close) we treat it
  // as completed. The trace's live-update flow will replace this row when the
  // span closes.
  if (agent.end_time_ms > 0 && agent.end_time_ms > agent.start_time_ms) return "completed";
  return "running";
}

const STATUS_STYLES: Record<SessionStatus, { color: string; bg: string; label: string }> = {
  running:   { color: C.orange, bg: "rgba(240,173,78,0.12)", label: "RUNNING"   },
  completed: { color: C.green,  bg: "rgba(96,227,109,0.12)", label: "COMPLETED" },
  failed:    { color: C.red,    bg: "rgba(235,20,20,0.12)",  label: "FAILED"    },
};

interface TreeNode {
  agent: SubAgent;
  children: TreeNode[];
}

/**
 * Build a forest of sub-agent tree nodes. A sub-agent A is a child of B if
 * A's root span's parent_span_id is contained in B's span_ids (and B is the
 * deepest such ancestor). Otherwise A is a root.
 */
function buildSessionForest(subAgents: SubAgent[], spans: Span[]): TreeNode[] {
  const spanById = new Map(spans.map(s => [s.id, s] as const));
  const agentByRootId = new Map(subAgents.map(a => [a.root_span_id, a] as const));

  // Map each sub-agent root to the set of span_ids it "owns"
  const ownerAgentId = new Map<string, string>(); // spanId -> root_span_id of owning agent
  for (const a of subAgents) {
    for (const id of a.span_ids) {
      // First-writer-wins is fine; agents nest, so an inner span already
      // belongs to the innermost agent that claimed it. We resolve true
      // ancestry via parent chain below instead of relying solely on this map.
      if (!ownerAgentId.has(id)) ownerAgentId.set(id, a.root_span_id);
    }
  }

  // For each sub-agent, walk up parent_span_id chain until we hit a span owned
  // by *another* sub-agent. That ancestor is the parent.
  const parentOf: Map<string, string | null> = new Map(); // childRootId -> parentRootId
  for (const a of subAgents) {
    const root = spanById.get(a.root_span_id);
    if (!root) { parentOf.set(a.root_span_id, null); continue; }
    let cursor = root.parent_span_id;
    let foundParent: string | null = null;
    while (cursor) {
      // Skip past the current agent's own spans (don't pick ourselves).
      const owner = ownerAgentId.get(cursor);
      if (owner && owner !== a.root_span_id) {
        foundParent = owner;
        break;
      }
      const span = spanById.get(cursor);
      if (!span) break;
      cursor = span.parent_span_id;
    }
    parentOf.set(a.root_span_id, foundParent);
  }

  const nodeByRootId = new Map<string, TreeNode>();
  for (const a of subAgents) {
    nodeByRootId.set(a.root_span_id, { agent: a, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const a of subAgents) {
    const node = nodeByRootId.get(a.root_span_id)!;
    const parentId = parentOf.get(a.root_span_id);
    if (parentId && nodeByRootId.has(parentId)) {
      nodeByRootId.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Keep ordering stable by start time within each level
  const sortRecursive = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.agent.start_time_ms - b.agent.start_time_ms);
    nodes.forEach(n => sortRecursive(n.children));
  };
  sortRecursive(roots);
  // Help linter understand agentByRootId is consumed (lookup parity safety net)
  void agentByRootId;
  return roots;
}

function SessionNode({
  node,
  depth,
  expanded,
  toggleExpand,
  onDiveIn,
}: {
  node: TreeNode;
  depth: number;
  expanded: Map<string, boolean>;
  toggleExpand: (id: string) => void;
  onDiveIn?: (rootSpanId: string) => void;
}) {
  const { agent, children } = node;
  const a = agent;
  const status = statusFromAgent(a);
  const s = STATUS_STYLES[status];
  const hasChildren = children.length > 0;
  const isOpen = expanded.get(a.root_span_id) ?? true;

  const name = a.subagent_name
    ? `${a.name}: ${a.subagent_name}`
    : a.name;

  const totals = `${a.llm_count} LLM · ${a.tool_count} tools` +
    (a.total_input_tokens > 0 || a.total_output_tokens > 0
      ? ` · ${a.total_input_tokens.toLocaleString()} in / ${a.total_output_tokens.toLocaleString()} out`
      : "");

  return (
    <div>
      <div
        className="flex items-center gap-2 cursor-default"
        style={{
          minHeight: 30,
          paddingLeft: depth * 16 + 8,
          paddingRight: 12,
          borderBottom: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <span aria-hidden style={{ width: 12, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(a.root_span_id)}
              title={isOpen ? "Collapse" : "Expand"}
              aria-label={isOpen ? "Collapse subtree" : "Expand subtree"}
              aria-expanded={isOpen}
              style={{
                width: 12, height: 12, padding: 0, background: "transparent",
                border: 0, color: C.fg1, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Chevron open={isOpen} size={10} />
            </button>
          ) : (
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 9999, background: C.borderLight }} />
          )}
        </span>

        <span
          className="text-[10px] font-mono font-bold px-1 py-0.5 rounded"
          style={{
            color: SPAN_TYPE_COLORS.SUB_AGENT_ROOT,
            background: `${SPAN_TYPE_COLORS.SUB_AGENT_ROOT}12`,
          }}
        >
          {SPAN_TYPE_LABELS.SUB_AGENT_ROOT}
        </span>

        <span
          className="text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: s.color, background: s.bg }}
          title={a.status}
        >
          {s.label}
        </span>

        <span
          className="text-[11px] font-mono truncate flex-1 min-w-0"
          style={{ color: status === "failed" ? C.red : C.fg3 }}
          title={name}
        >
          {name}
        </span>

        {a.model && (
          <span
            className="text-[10px] font-mono"
            style={{ color: C.fg0 }}
            title="model"
          >
            {a.model}
          </span>
        )}

        <span className="text-[10px] font-mono text-right" style={{ color: C.fg0, minWidth: 56 }} title="duration">
          {fmt(a.duration_ms)}
        </span>

        {onDiveIn && (
          <button
            type="button"
            onClick={() => onDiveIn(a.root_span_id)}
            className="text-[10px] font-medium px-2 py-0.5 rounded transition"
            style={{
              color: C.fg3,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            title="Open this sub-agent"
          >
            Open
          </button>
        )}
      </div>

      {hasChildren && isOpen && (
        <div>
          {/* Per-node meta line: tool + token totals, only when expanded */}
          <div
            className="text-[10px] font-mono"
            style={{ color: C.fg0, paddingLeft: depth * 16 + 12 + 12 + 4, paddingBottom: 4, paddingTop: 2 }}
          >
            {totals}
          </div>
          {children.map(child => (
            <SessionNode
              key={child.agent.root_span_id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggleExpand={toggleExpand}
              onDiveIn={onDiveIn}
            />
          ))}
        </div>
      )}

      {hasChildren && !isOpen && (
        <div
          className="text-[10px] font-mono"
          style={{ color: C.fg0, paddingLeft: depth * 16 + 12 + 12 + 4, paddingBottom: 4 }}
        >
          {children.length} nested · {totals}
        </div>
      )}
    </div>
  );
}

export interface SessionTreeProps {
  subAgents: SubAgent[];
  spans: Span[];
  /** Fired with the sub-agent's root span id when the user clicks "Open". */
  onDiveIn?: (rootSpanId: string) => void;
}

export function SessionTree({ subAgents, spans, onDiveIn }: SessionTreeProps) {
  const forest = useMemo(() => buildSessionForest(subAgents, spans), [subAgents, spans]);

  // Expand/collapse state; defaults to fully expanded. Keyed by root_span_id.
  const [expanded, setExpanded] = useState<Map<string, boolean>>(() => {
    const m = new Map<string, boolean>();
    for (const a of subAgents) m.set(a.root_span_id, true);
    return m;
  });
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Map(prev);
      next.set(id, !(next.get(id) ?? true));
      return next;
    });
  };

  if (subAgents.length === 0) {
    return (
      <div
        className="rounded-lg"
        style={{
          padding: 24,
          textAlign: "center",
          color: C.fg1,
          border: `1px solid ${C.border}`,
          background: C.surface,
        }}
      >
        <div className="text-[12px] font-medium" style={{ color: C.fg2 }}>
          No sub-agent sessions detected
        </div>
        <div className="text-[11px] mt-1" style={{ color: C.fg0 }}>
          Sub-agents are detected automatically when a TOOL_CALL span contains an LLM_GENERATION child that itself calls tools (TOOL &gt; LLM &gt; TOOL).
        </div>
      </div>
    );
  }

  // Aggregate stats for the header summary
  const totalAgents = subAgents.length;
  const failed = subAgents.filter(a => statusFromAgent(a) === "failed").length;
  const running = subAgents.filter(a => statusFromAgent(a) === "running").length;
  const completed = subAgents.filter(a => statusFromAgent(a) === "completed").length;
  const totalDur = subAgents.reduce((s, a) => s + a.duration_ms, 0);
  const totalIn = subAgents.reduce((s, a) => s + a.total_input_tokens, 0);
  const totalOut = subAgents.reduce((s, a) => s + a.total_output_tokens, 0);

  return (
    <div className="flex flex-col h-full rounded-lg" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
      {/* Header summary */}
      <div
        className="flex flex-wrap items-center gap-3 px-3 py-2"
        style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(212,168,87,0.04)" }}
      >
        <span
          className="text-[9px] uppercase tracking-wider font-semibold"
          style={{ color: SPAN_TYPE_COLORS.SUB_AGENT_ROOT }}
        >
          Session Tree
        </span>
        <span className="text-[10px] font-mono" style={{ color: C.fg2 }}>
          {totalAgents} session{totalAgents === 1 ? "" : "s"}
        </span>
        <span className="text-[10px] font-mono" style={{ color: STATUS_STYLES.completed.color }}>
          {completed} done
        </span>
        {running > 0 && (
          <span className="text-[10px] font-mono" style={{ color: STATUS_STYLES.running.color }}>
            {running} running
          </span>
        )}
        {failed > 0 && (
          <span className="text-[10px] font-mono" style={{ color: STATUS_STYLES.failed.color }}>
            {failed} failed
          </span>
        )}
        <span className="text-[10px] font-mono" style={{ color: C.fg0 }}>
          Σ {fmt(totalDur)}
        </span>
        {(totalIn > 0 || totalOut > 0) && (
          <span className="text-[10px] font-mono" style={{ color: C.fg0 }}>
            Σ {totalIn.toLocaleString()} in / {totalOut.toLocaleString()} out
          </span>
        )}
      </div>

      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <span style={{ width: 12, display: "inline-block" }} />
        <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: C.fg0, width: 50 }}>Type</span>
        <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: C.fg0, width: 90 }}>Status</span>
        <span className="text-[9px] uppercase tracking-wider font-medium flex-1" style={{ color: C.fg0 }}>Name</span>
        <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: C.fg0, minWidth: 120 }}>Model</span>
        <span className="text-[9px] uppercase tracking-wider font-medium text-right" style={{ color: C.fg0, minWidth: 56 }}>Dur</span>
        <span style={{ width: 48, display: "inline-block" }} />
      </div>

      {/* Tree body */}
      <div className="flex-1 overflow-auto sb">
        {forest.map(node => (
          <SessionNode
            key={node.agent.root_span_id}
            node={node}
            depth={0}
            expanded={expanded}
            toggleExpand={toggleExpand}
            onDiveIn={onDiveIn}
          />
        ))}
      </div>
    </div>
  );
}
