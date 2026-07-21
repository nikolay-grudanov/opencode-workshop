export function ExportButton({ runId, theme }: { runId: string; theme?: "light" | "dark" }): JSX.Element {
  const resolvedTheme =
    theme ?? (() => {
      try {
        const stored = localStorage.getItem("workshop.theme");
        if (stored === "light" || stored === "dark") return stored;
      } catch {
        // localStorage may be unavailable in some environments
      }
      return "dark";
    })();

  const url = `/api/runs/${runId}/export${resolvedTheme === "light" ? "?theme=light" : ""}`;

  return (
    <button
      className="flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-md font-medium transition-colors hover:bg-white/10"
      style={{ color: "#a0a8b0", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
      onClick={() => window.open(url, "_blank")}
      title="Export as HTML"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export as HTML
    </button>
  );
}
