import { useCallback, useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, Loader2, AlertCircle, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { C } from "../utils/colors";
import { ago } from "../utils/helpers";
import { runPath } from "../utils/navigation";
import { useT } from "../i18n";

/**
 * F-017: local multi-filter search across all Workshop spans.
 *
 * Backed by GET /api/search (no cloud). Filterable dimensions:
 *   - free-text query (FTS5 BM25)
 *   - agent (event_name), user, project, branch, commit prefix
 *   - model, span name, span type
 *   - hasErrors (status=ERROR or live_event=error)
 *   - date from/to
 */

interface Facets {
  agents: string[];
  users: string[];
  projects: string[];
  branches: string[];
  models: string[];
  spans: string[];
}

interface SearchResult {
  span_id: string;
  run_id: string;
  span_name: string;
  span_type: string | null;
  model: string | null;
  snippet: string;
  bm25: number;
  event_name: string | null;
  user_id: string | null;
  git: { project?: string; branch?: string; commit?: string } | null;
}

interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  agents: string[];
  users: string[];
  projects: string[];
  branches: string[];
  models: string[];
  spans: string[];
}

interface FilterState {
  q: string;
  agent: string;
  user: string;
  project: string;
  branch: string;
  commit: string;
  model: string;
  spanName: string;
  spanType: string;
  hasErrors: boolean;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: FilterState = {
  q: "",
  agent: "",
  user: "",
  project: "",
  branch: "",
  commit: "",
  model: "",
  spanName: "",
  spanType: "",
  hasErrors: false,
  dateFrom: "",
  dateTo: "",
};

const SPAN_TYPES = ["TRACE", "LLM_GENERATION", "TOOL_CALL", "AGENT_ROOT", "INTERNAL"];

function isFilterActive(f: FilterState): boolean {
  return (
    f.q.trim().length > 0 ||
    !!f.agent ||
    !!f.user ||
    !!f.project ||
    !!f.branch ||
    !!f.commit ||
    !!f.model ||
    !!f.spanName ||
    !!f.spanType ||
    f.hasErrors ||
    !!f.dateFrom ||
    !!f.dateTo
  );
}

function filterToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.agent) p.set("agent", f.agent);
  if (f.user) p.set("user", f.user);
  if (f.project) p.set("project", f.project);
  if (f.branch) p.set("branch", f.branch);
  if (f.commit) p.set("commit", f.commit);
  if (f.model) p.set("model", f.model);
  if (f.spanName) p.set("spanName", f.spanName);
  if (f.spanType) p.set("spanType", f.spanType);
  if (f.hasErrors) p.set("hasErrors", "true");
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo) p.set("dateTo", f.dateTo);
  return p;
}

export function SearchPage() {
  const navigate = useNavigate();
  const { runId: routeRunId } = useParams<{ runId?: string }>();
  const { t } = useT();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetch("/api/facets")
      .then((r) => r.json())
      .then(setFacets)
      .catch(() => setFacets({ agents: [], users: [], projects: [], branches: [], models: [], spans: [] }));
  }, []);

  const runSearch = useCallback(async (f: FilterState) => {
    if (!isFilterActive(f)) {
      setResponse(null);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const params = filterToParams(f);
      params.set("limit", "100");
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as SearchResponse;
      setResponse(data);
    } catch (err) {
      setError((err as Error).message);
      setResponse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // If route has runId, focus that run as a side preview
  const focusedRunId = routeRunId ? decodeURIComponent(routeRunId) : null;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(draft);
    void runSearch(draft);
  };

  const onClear = () => {
    setDraft(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setResponse(null);
    setError(null);
    setHasSearched(false);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n++;
    if (filters.agent) n++;
    if (filters.user) n++;
    if (filters.project) n++;
    if (filters.branch) n++;
    if (filters.commit) n++;
    if (filters.model) n++;
    if (filters.spanName) n++;
    if (filters.spanType) n++;
    if (filters.hasErrors) n++;
    if (filters.dateFrom) n++;
    if (filters.dateTo) n++;
    return n;
  }, [filters]);

  const groupedResults = useMemo(() => {
    if (!response) return [] as Array<{ run_id: string; items: SearchResult[] }>;
    const map = new Map<string, SearchResult[]>();
    for (const r of response.results) {
      if (!map.has(r.run_id)) map.set(r.run_id, []);
      map.get(r.run_id)!.push(r);
    }
    return Array.from(map.entries()).map(([run_id, items]) => ({ run_id, items }));
  }, [response]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: filters */}
      <form
        onSubmit={onSubmit}
        className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-black/30 px-4 py-3 text-sm"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: C.fg1 }}>
            {t("search.title", { defaultValue: "Search" })} {activeFilterCount > 0 && `(${activeFilterCount})`}
          </span>
          {isFilterActive(draft) && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] uppercase tracking-wide text-white/50 hover:bg-white/[0.05] hover:text-white/80"
            >
              <X className="h-3 w-3" />
              {t("search.clearFilters", { defaultValue: "Clear" })}
            </button>
          )}
        </div>

        <Field
          label={t("search.query", { defaultValue: "Free-text query" })}
          hint={t("search.queryHint", { defaultValue: "FTS5 over span names, models, payloads, attributes" })}
        >
          <input
            type="text"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
            placeholder={t("search.queryPlaceholder", { defaultValue: "substring or token" })}
            className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white/90 placeholder:text-white/35 focus:border-white/25 focus:outline-none"
          />
        </Field>

        <SelectField
          label={t("search.agent", { defaultValue: "Agent (event_name)" })}
          value={draft.agent}
          options={facets?.agents ?? []}
          onChange={(v) => setDraft({ ...draft, agent: v })}
        />
        <SelectField
          label={t("search.user", { defaultValue: "User" })}
          value={draft.user}
          options={facets?.users ?? []}
          onChange={(v) => setDraft({ ...draft, user: v })}
        />
        <SelectField
          label={t("search.project", { defaultValue: "Project" })}
          value={draft.project}
          options={facets?.projects ?? []}
          onChange={(v) => setDraft({ ...draft, project: v })}
        />
        <SelectField
          label={t("search.branch", { defaultValue: "Branch" })}
          value={draft.branch}
          options={facets?.branches ?? []}
          onChange={(v) => setDraft({ ...draft, branch: v })}
        />
        <Field label={t("search.commitPrefix", { defaultValue: "Commit prefix" })}>
          <input
            type="text"
            value={draft.commit}
            onChange={(e) => setDraft({ ...draft, commit: e.target.value })}
            placeholder={t("search.commitPlaceholder", { defaultValue: "abc1234" })}
            className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white/90 placeholder:text-white/35 focus:border-white/25 focus:outline-none"
          />
        </Field>
        <SelectField
          label={t("search.model", { defaultValue: "Model" })}
          value={draft.model}
          options={facets?.models ?? []}
          onChange={(v) => setDraft({ ...draft, model: v })}
        />
        <SelectField
          label={t("search.spanName", { defaultValue: "Span name" })}
          value={draft.spanName}
          options={facets?.spans ?? []}
          onChange={(v) => setDraft({ ...draft, spanName: v })}
        />
        <SelectField
          label={t("search.spanType", { defaultValue: "Span type" })}
          value={draft.spanType}
          options={SPAN_TYPES}
          onChange={(v) => setDraft({ ...draft, spanType: v })}
        />

        <Field label={t("search.dateRange", { defaultValue: "Date range" })}>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={draft.dateFrom}
              onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })}
              className="flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/90 focus:border-white/25 focus:outline-none"
            />
            <span className="text-white/40 text-xs">—</span>
            <input
              type="date"
              value={draft.dateTo}
              onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })}
              className="flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/90 focus:border-white/25 focus:outline-none"
            />
          </div>
        </Field>

        <label className="mb-3 mt-1 flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={draft.hasErrors}
            onChange={(e) => setDraft({ ...draft, hasErrors: e.target.checked })}
            className="h-3 w-3 rounded border-white/20 bg-black/40"
          />
          <span>{t("search.hasErrors", { defaultValue: "Only spans with errors" })}</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-auto inline-flex items-center justify-center gap-2 rounded bg-white/10 px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchIcon className="h-3.5 w-3.5" />}
          {t("search.runSearch", { defaultValue: "Search" })}
        </button>
      </form>

      {/* Right: results */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!hasSearched && !focusedRunId && (
          <div className="grid h-full place-items-center text-center text-sm" style={{ color: C.fg1 }}>
            <div>
              <SearchIcon className="mx-auto mb-3 h-8 w-8 opacity-30" />
              <p>{t("search.intro", { defaultValue: "Set any combination of filters above and click Search." })}</p>
              <p className="mt-2 text-xs opacity-70">
                {t("search.introHint", {
                  defaultValue: "Faceted values come from the runs table; free-text matches span names, payloads, attributes.",
                })}
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: C.fg1 }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("search.searching", { defaultValue: "Searching…" })}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{t("search.searchFailed", { defaultValue: "Search failed" })}</p>
              <p className="text-xs text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        {response && (
          <div className="mb-3 flex items-center justify-between text-xs" style={{ color: C.fg1 }}>
            <span>
              {t("search.resultsCount", {
                defaultValue: `${response.total} spans across ${groupedResults.length} runs`,
                total: response.total,
                runs: groupedResults.length,
              })}
            </span>
            <span className="text-white/40">{t("search.bm25", { defaultValue: "ranked by BM25" })}</span>
          </div>
        )}

        <div className="space-y-4">
          {groupedResults.map(({ run_id, items }) => (
            <RunGroup
              key={run_id}
              runId={run_id}
              items={items}
              onOpenRun={() => navigate(runPath(run_id))}
            />
          ))}
        </div>

        {focusedRunId && groupedResults.length === 0 && !loading && (
          <p className="text-sm" style={{ color: C.fg1 }}>
            {t("search.noResults", { defaultValue: "No matches. Try a wider set of filters." })}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-white/55">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] leading-snug text-white/35">{hint}</p>}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white/90 focus:border-white/25 focus:outline-none"
      >
        <option value="">— any —</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function RunGroup({
  runId,
  items,
  onOpenRun,
}: {
  runId: string;
  items: SearchResult[];
  onOpenRun: () => void;
}) {
  const { t } = useT();
  const first = items[0];
  const agent = first?.event_name ?? null;
  return (
    <div className="rounded border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenRun}
          className="flex items-center gap-2 truncate font-mono text-sm text-white/90 hover:text-white"
        >
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px]">{runId.slice(0, 8)}</span>
          {agent && <span className="text-xs text-white/60">{agent}</span>}
          {first?.git?.branch && (
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-white/55">
              {first.git.branch}
            </span>
          )}
        </button>
        <span className="text-[10px] text-white/40">
          {items.length} {t("search.matchSuffix", { defaultValue: "match" })}{items.length !== 1 ? "es" : ""}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((r) => (
          <li key={r.span_id} className="flex items-baseline gap-2 text-xs">
            <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/65">
              {r.span_type ?? "?"}
            </span>
            <span className="font-mono text-white/80">{r.span_name}</span>
            {r.model && <span className="text-white/40">{r.model}</span>}
            <span
              className="ml-auto flex-1 truncate text-right text-white/55"
              dangerouslySetInnerHTML={{ __html: r.snippet }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Legacy cloud-backed search payload removed in F-017. The old /v1/events/search
// path is no longer reachable from this page. If a remote EventsPage is needed
// in the future, see git history (commit before 4b63371).

// No-op stub retained so RunDetail.tsx still imports cleanly. F-017 dropped the
// query.raindrop.ai dependency; old RemoteConvoLoader logic was cloud-only.
export function RemoteConvoLoader(_props: { convoId: string; highlightEventId: string }) {
  return null;
}
