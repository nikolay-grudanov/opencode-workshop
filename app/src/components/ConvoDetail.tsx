import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HelpCircle, ChevronDown } from "lucide-react";
import { C } from "../utils/colors";
import { ago, fmt } from "../utils/helpers";
import { Dots } from "./Icons";
import { ToolCallPill } from "./ToolCallPill";
import { Markdown } from "./Markdown";
import type { Run } from "../utils/types";
import { buildConvoEvents } from "./convo-events";
import { useWorkshopEvent } from "../hooks/use-workshop-ws";
import { useConversationDetail } from "../hooks/use-runs";
import { useConvoStatistics } from "../hooks/use-convo-statistics";

/**
 * F-012: cross-run Convo Statistics panel. Shows total wall-clock, span and
 * tool counts, token coverage (X/Y spans with token counts), total tokens and
 * per-model rollup. The panel is intentionally compact: numbers + small tables,
 * no histograms (those come in a follow-up if requested).
 *
 * Disclaimers: surfaces data-quality limitations surfaced by the F-012 review
 * (e.g., end-time coverage, error detection). Numbers are computed server-side
 * by `getConvoStatistics` in `src/db.ts`.
 */
function ConvoStatsPanel({ convoId }: { convoId: string }) {
  const stats = useConvoStatistics(convoId);
  const [expanded, setExpanded] = useState(true);

  if (stats.isLoading) {
    return (
      <div className="text-[11px] font-mono px-3 py-2 rounded" style={{ background: "rgba(255,255,255,0.025)", color: C.fg0 }}>
        Loading conversation statistics…
      </div>
    );
  }
  if (stats.isError || !stats.data) {
    return (
      <div className="text-[11px] font-mono px-3 py-2 rounded" style={{ background: "rgba(204,102,102,0.06)", color: C.red }}>
        Failed to load conversation statistics: {stats.error instanceof Error ? stats.error.message : "unknown"}
      </div>
    );
  }

  const s = stats.data;
  const noData = s.run_count === 0 && s.span_count === 0;
  const errors = s.error_span_count;
  const errColor = errors > 0 ? C.red : C.fg2;
  const tokenPct = s.span_count > 0 ? Math.round((s.span_with_tokens / s.span_count) * 100) : 0;

  return (
    <div className="rounded-lg" style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${C.border}` }}>
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-medium uppercase tracking-wide px-1.5 rounded" style={{ background: "rgba(255,255,255,0.09)", color: C.fg1, lineHeight: "16px" }}>
            Convo Stats
          </span>
          <span className="text-[11px] font-mono" style={{ color: C.fg2 }}>
            {s.run_count} run{s.run_count !== 1 ? "s" : ""} · {s.span_count} span{s.span_count !== 1 ? "s" : ""}
          </span>
          {(s.tokens.in > 0 || s.tokens.out > 0) && (
            <span className="text-[11px] font-mono" style={{ color: C.fg1 }}>
              · {(s.tokens.in + s.tokens.out).toLocaleString()} tokens
            </span>
          )}
          {errors > 0 && (
            <span className="text-[11px] font-mono" style={{ color: C.red }}>
              · {errors} error{errors !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span style={{ display: "inline-flex", transform: expanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 120ms" }}>
          <ChevronDown size={14} />
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          {noData ? (
            <div className="text-[11px]" style={{ color: C.fg0 }}>
              No spans available for this conversation.
            </div>
          ) : (
            <>
              {/* Totals grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
                <div style={{ color: C.fg0 }}>duration</div>
                <div style={{ color: C.fg2 }}>{fmt(s.wall_clock_ms)}</div>
                <div style={{ color: C.fg0 }}>LLM calls</div>
                <div style={{ color: C.fg2 }}>{s.llm_span_count}</div>
                <div style={{ color: C.fg0 }}>tool calls</div>
                <div style={{ color: C.fg2 }}>{s.tool_span_count}</div>
                <div style={{ color: C.fg0 }}>sub-agents</div>
                <div style={{ color: C.fg2 }}>{s.subagent_count}</div>
                <div style={{ color: C.fg0 }}>errors</div>
                <div style={{ color: errColor }}>{errors}</div>
              </div>

              {/* Tokens (with disclaimer) */}
              <div className="rounded p-2 text-[11px]" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 font-mono mb-1">
                  <span style={{ color: C.fg0 }}>tokens</span>
                  <span style={{ color: C.fg2 }}>{s.tokens.in.toLocaleString()} in</span>
                  <span style={{ color: C.fg0, opacity: 0.4 }}>/</span>
                  <span style={{ color: C.fg2 }}>{s.tokens.out.toLocaleString()} out</span>
                </div>
                <div style={{ color: C.fg0, opacity: 0.8 }}>
                  covered: {s.span_with_tokens}/{s.span_count} spans ({tokenPct}%).
                  {tokenPct < 100 && " Totals undercount spans that didn't report tokens."}
                </div>
              </div>

              {/* Per-model rollup */}
              {s.by_model.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wide font-medium mb-1" style={{ color: C.fg1 }}>By model</div>
                  <table className="w-full text-[11px]">
                    <tbody>
                      {s.by_model.map(m => (
                        <tr key={m.model}>
                          <td className="font-mono truncate pr-2 max-w-[220px]" style={{ color: C.fg2 }} title={m.model}>{m.model}</td>
                          <td className="font-mono text-right whitespace-nowrap" style={{ color: C.fg1 }}>{(m.in + m.out).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Per-run rollup */}
              {s.runs.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wide font-medium mb-1" style={{ color: C.fg1 }}>Per-run</div>
                  <table className="w-full text-[11px]">
                    <tbody>
                      {s.runs.map(r => (
                        <tr key={r.id}>
                          <td className="font-mono truncate pr-2 max-w-[180px]" style={{ color: C.fg2 }} title={r.event_name ?? r.id}>{r.event_name ?? r.id}</td>
                          <td className="font-mono text-right whitespace-nowrap pr-2" style={{ color: C.fg1 }}>{fmt(r.wall_clock_ms)}</td>
                          <td className="font-mono text-right whitespace-nowrap" style={{ color: C.fg1 }}>{(r.tokens.in + r.tokens.out).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationHeader({ runCount }: { runCount: number }) {
  return (
    <div className="text-[11px] font-mono inline-flex items-center gap-1.5" style={{ color: C.fg1 }}>
      <span>conversation</span>
      <span className="relative group inline-flex items-center">
        <HelpCircle size={13} style={{ color: C.fg0, cursor: "help" }} />
        <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block">
          <div className="rounded-lg px-3 py-2 text-[11px] leading-relaxed whitespace-nowrap shadow-xl"
            style={{ background: C.elevated, border: `1px solid ${C.borderLight}`, color: C.fg3 }}>
            Conversation groups separate runs that share the same <span className="font-mono" style={{ color: C.fg4 }}>convo_id</span>
          </div>
        </div>
      </span>
      <span style={{ color: C.fg0 }}>&middot;</span>
      <span>{runCount} run{runCount !== 1 ? "s" : ""}</span>
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end px-4 pt-5 pb-1">
      <div className="max-w-[65%] px-3.5 py-2.5 rounded-2xl rounded-br-md" style={{ background: C.user }}>
        <div className="relative">
          <pre className="text-sm leading-relaxed font-sans whitespace-pre-wrap" style={{ color: C.fg3 }}>
            {content}
          </pre>
        </div>
      </div>
    </div>
  );
}

function TurnDivider({ index, run, onOpen, onHover }: { index: number; run: Run; onOpen: () => void; onHover: (hovering: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-6 pb-2">
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ color: C.fg1, background: "rgba(255,255,255,0.04)" }}>
        run {index + 1}
      </span>
      <span className="text-[10px]" style={{ color: C.fg0 }}>{ago(run.started_at)}</span>
      <button
        className="text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
        style={{ color: C.fg1, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)` }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; onHover(true); }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; onHover(false); }}
        onClick={onOpen}
      >
        open &rarr;
      </button>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
}

export function ConvoDetail({ convoId, onOpenTurn }: { convoId: string; onOpenTurn?: (runId: string) => void }) {
  const queryClient = useQueryClient();
  const { turns, runIds, isLoading, isError } = useConversationDetail(convoId);
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const colorMap = useMemo(() => new Map<string, string>(), []);

  useWorkshopEvent("spans", () => {
    void queryClient.invalidateQueries({ queryKey: ["conversation-runs", convoId] });
    for (const runId of runIds) {
      void queryClient.invalidateQueries({ queryKey: ["run-detail", runId] });
    }
  });
  useWorkshopEvent("live", () => {
    for (const runId of runIds) {
      void queryClient.invalidateQueries({ queryKey: ["run-detail", runId] });
    }
  });

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const events = useMemo(() => buildConvoEvents(turns), [turns]);

  if (isLoading) return <div className="flex items-center justify-center h-full gap-2" style={{ color: C.fg1 }}>Loading <Dots /></div>;
  if (isError) return <div className="flex items-center justify-center h-full" style={{ color: C.fg1 }}>Could not load conversation</div>;
  if (turns.length === 0) return <div className="flex items-center justify-center h-full" style={{ color: C.fg1 }}>No runs found</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <ConversationHeader runCount={turns.length} />
      </div>

      {/* F-012: cross-run convo statistics — collapsible panel below the header. */}
      <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <ConvoStatsPanel convoId={convoId} />
      </div>

      {/* Event stream */}
      <div ref={scrollRef} className="flex-1 overflow-auto sb pb-24">
        {events.map((evt, i) => {
          const turnIdx = evt.turnIndex;
          const dimmed = hoveredTurn !== null && turnIdx !== hoveredTurn;

          if (evt.type === "turn_start") {
            return (
              <div key={`td${i}`} style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity 0.15s" }}>
                <TurnDivider index={evt.turnIndex} run={evt.run}
                  onOpen={() => onOpenTurn?.(evt.run.id)}
                  onHover={(h) => setHoveredTurn(h ? evt.turnIndex : null)} />
              </div>
            );
          }

          if (evt.type === "user_msg") {
            return (
              <div key={`um${i}`} style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity 0.15s" }}>
                <UserMessage content={evt.content} />
              </div>
            );
          }

          if (evt.type === "tool_group") {
            return (
              <div key={`tg${i}`} className="flex flex-wrap gap-1.5 px-4 py-1" style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity 0.15s" }}>
                {evt.spans.map(s => (
                  <ToolCallPill key={s.id} span={s} colorMap={colorMap} />
                ))}
              </div>
            );
          }

          if (evt.type === "llm_out") {
            return (
              <div key={`lo${i}`} className="max-w-[85%] px-4 py-2" style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity 0.15s" }}>
                <div className="text-message leading-relaxed" style={{ color: C.fg3 }}>
                  <Markdown>{evt.content}</Markdown>
                </div>
              </div>
            );
          }

          if (evt.type === "active") {
            return (
              <div key={`act${i}`} className="px-4 py-2 text-[11px] font-mono" style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity 0.15s", color: C.fg0 }}>
                running <Dots />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
