import { useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { NavSidebar, type Page } from "./components/NavSidebar";
import { MessagePane } from "./components/MessagePane";
import { RunsPage } from "./pages/RunsPage";
import { SearchPage } from "./pages/SearchPage";
import { SavedPage } from "./pages/SavedPage";
import { SettingsPage } from "./pages/SettingsPage";
import { sendWorkshopMessage, useWorkshopConnected } from "./hooks/use-workshop-ws";
import { useAgentUiCommands } from "./hooks/use-agent-ui-commands";

const PAGES: Record<Page, React.ComponentType> = {
  runs: RunsPage,
  search: SearchPage,
  saved: SavedPage,
  settings: SettingsPage,
};

const DISCONNECTED_NOTICE_DELAY_MS = 100;

function useActiveRunId(): string | null {
  const [id, setId] = useState<string | null>(() => {
    const h = window.location.hash.replace("#", "");
    return h || null;
  });
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace("#", "");
      setId(h || null);
    };
    window.addEventListener("hashchange", onHash);
    // The app sets location.hash programmatically without firing hashchange in
    // some code paths, so poll as a safety net.
    const i = setInterval(onHash, 500);
    return () => {
      window.removeEventListener("hashchange", onHash);
      clearInterval(i);
    };
  }, []);
  return id;
}

export function App() {
  const [page, setPage] = useState<Page>("runs");
  const [showDisconnectedNotice, setShowDisconnectedNotice] = useState(false);
  const PageComponent = PAGES[page];
  const activeRunId = useActiveRunId();
  const workshopConnected = useWorkshopConnected();
  useAgentUiCommands();

  useEffect(() => {
    if (workshopConnected) {
      setShowDisconnectedNotice(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setShowDisconnectedNotice(true);
    }, DISCONNECTED_NOTICE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [workshopConnected]);

  useEffect(() => {
    sendWorkshopMessage({ type: "ui_view", run_id: activeRunId });
  }, [activeRunId]);

  // Programmatic page navigation triggered by agent UI commands
  // (see use-agent-ui-commands.ts).
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const next = (e as CustomEvent<{ page?: Page }>).detail?.page;
      if (next && next in PAGES) setPage(next);
    };
    window.addEventListener("workshop:navigate", onNavigate);
    return () => window.removeEventListener("workshop:navigate", onNavigate);
  }, []);

  return (
    <SidebarProvider defaultOpen={false}>
      <NavSidebar activePage={page} onNavigate={setPage} />
      <SidebarInset>
        <div className="relative h-screen overflow-hidden">
          <div
            className={`flex h-full transition-all duration-200 ${showDisconnectedNotice ? "pointer-events-none select-none blur-sm opacity-45" : ""}`}
            aria-hidden={showDisconnectedNotice}
          >
            <div className="flex-1 min-w-0 overflow-auto">
              <PageComponent />
            </div>
            <MessagePane activeRunId={activeRunId} />
          </div>
          {showDisconnectedNotice && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 px-6">
              <div
                className="flex min-h-[180px] w-[520px] max-w-full flex-col items-center justify-center rounded-[10px] border border-white/10 bg-zinc-950/90 px-9 py-6 text-center shadow-2xl shadow-black/50 backdrop-blur"
                style={{ fontFamily: '"AlphaLyrae", sans-serif' }}
              >
                <div className="text-lg font-medium text-white/90">Workshop isn&apos;t running.</div>
                <div className="mt-4 text-[15px] leading-relaxed text-white/62">
                  Run <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/90">raindrop workshop</code> from your terminal to resume.
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
