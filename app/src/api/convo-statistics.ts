// F-012: cross-run convo statistics endpoint.
import { apiJson } from "./request";

export interface ConvoStatistics {
  convo_id: string;
  run_count: number;
  span_count: number;
  llm_span_count: number;
  tool_span_count: number;
  subagent_count: number;
  error_span_count: number;
  wall_clock_ms: number;
  span_with_tokens: number;
  tokens: { in: number; out: number };
  by_model: Array<{ model: string; in: number; out: number }>;
  runs: Array<{
    id: string;
    event_name: string | null;
    started_at: number;
    wall_clock_ms: number;
    tokens: { in: number; out: number };
  }>;
}

export function getConvoStatistics(convoId: string): Promise<ConvoStatistics> {
  return apiJson<ConvoStatistics>(`/api/convo/${encodeURIComponent(convoId)}/statistics`);
}
