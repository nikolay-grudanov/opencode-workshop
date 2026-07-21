import { useEffect, useRef, useState } from "react";
import { C } from "../utils/colors";
import { fmt, trunc } from "../utils/helpers";
import type { Span, SubAgent } from "../utils/types";
import { Button } from "./Button";
import { Check, Chevron } from "./Icons";

export function SubAgentBlock({ agent, spans, onDiveIn }: { agent: SubAgent; spans: Span[]; onDiveIn?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const a = agent;

  const agentSpanSet = new Set(a.span_ids);
  const rootSpan = spans.find(s => s.id === a.root_span_id);
  const agentToolSpans = spans.filter(s => agentSpanSet.has(s.id) && s.span_type === "TOOL_CALL" && s.id !== a.root_span_id);
  const agentLLMs = spans.filter(s => agentSpanSet.has(s.id) && s.span_type?.includes("LLM") && s.id !== a.root_span_id);
  const agentInput = agentLLMs.find(s => s.input_payload)?.input_payload ?? rootSpan?.input_payload;
  const agentOutput = agentLLMs.find(s => s.output_payload);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const popH = 320;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      setPos({ top: spaceBelow >= popH ? rect.bottom + 4 : Math.max(4, rect.top - popH - 4), left: rect.left });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (!btnRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="inline-block">
      <button ref={btnRef}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium"
        style={{ background: "rgba(90,138,176,0.10)", border: "1px solid rgba(90,138,176,0.22)", color: C.fg2 }}
        onClick={() => setOpen(!open)}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider px-1 rounded leading-none"
          style={{ color: "#7aaccc", background: "rgba(90,138,176,0.15)", padding: "2px 4px" }}>agent</span>
        <span style={{ color: C.fg4 }}>{a.name}</span>
        <span style={{ color: C.fg0, fontSize: "10px" }}>{a.tool_count} tools &middot; {fmt(a.duration_ms)}</span>
        <Chevron open={open} size={10} />
      </button>

        {open && pos && (
          <div
            className="fixed z-[9999] rounded-lg shadow-xl flex flex-col"
            style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 380), width: 360, maxHeight: 340, background: C.elevated, border: `1px solid ${C.borderLight}` }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="p-3 space-y-2 overflow-auto sb flex-1 min-h-0">
              {agentInput && (
                <div className="flex justify-end">
                  <div className="max-w-[90%] px-2.5 py-1.5 rounded-2xl rounded-br-md" style={{ background: C.user }}>
                    <pre className="text-[11px] font-sans leading-snug whitespace-pre-wrap" style={{ color: C.fg3 }}>{trunc(agentInput, 150)}</pre>
                  </div>
                </div>
              )}

              {agentToolSpans.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {agentToolSpans.map(s => (
                    <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono"
                      style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, color: C.fg3 }}>
                      <Check /> {s.name} <span style={{ color: C.fg0 }}>{fmt(s.duration_ms)}</span>
                    </span>
                  ))}
                </div>
              )}

              {agentOutput?.output_payload && (
                <div>
                  <div className="text-[9px] uppercase tracking-wide mb-0.5 font-medium" style={{ color: C.fg0 }}>Output</div>
                  <pre className="text-[11px] font-sans leading-relaxed whitespace-pre-wrap" style={{ color: C.fg2 }}>{trunc(agentOutput.output_payload, 150)}</pre>
                </div>
              )}

            </div>

            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2" style={{ borderTop: `1px solid ${C.border}` }}>
              {onDiveIn ? (
                <Button onClick={() => { setOpen(false); onDiveIn(a.root_span_id); }}>
                  Open Sub-Agent &rarr;
                </Button>
              ) : <div />}
              <div className="text-[10px] font-mono text-right" style={{ color: C.fg0 }}>
                {a.model && <>{a.model} &middot; </>}
                {a.llm_count} LLM &middot; {a.tool_count} tools &middot; {fmt(a.duration_ms)}
                {a.total_input_tokens > 0 && <> &middot; {a.total_input_tokens.toLocaleString()} in</>}
                {a.total_output_tokens > 0 && <> &middot; {a.total_output_tokens.toLocaleString()} out</>}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}