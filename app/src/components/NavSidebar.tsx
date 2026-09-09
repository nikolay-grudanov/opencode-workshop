import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Activity, Bookmark, Search, Settings } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useT } from "../i18n";
import { LangSwitcher } from "./LangSwitcher";

export type Page = "runs" | "search" | "saved" | "settings";

const NAV_ITEMS: { id: Page; labelKey: string; path: string; icon: typeof Activity }[] = [
  { id: "runs", labelKey: "nav.runs", path: "/runs", icon: Activity },
  { id: "search", labelKey: "nav.search", path: "/search", icon: Search },
  { id: "saved", labelKey: "nav.saved", path: "/saved", icon: Bookmark },
];

function isNavPathActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavSidebarInner() {
  const { state, setOpen, openMobile, isMobile } = useSidebar();
  // Used to expand the sidebar when the user hovers/clicks the lang switcher
  // so the EN/RU labels fit.
  const activate = () => {
    if (isMobile) openMobile();
    else setOpen(true);
  };
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useT();
  const onSettings = location.pathname === "/settings";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ id, labelKey, path, icon: Icon }) => {
                const label = t(labelKey);
                return (
                <SidebarMenuItem key={id}>
                  {(() => {
                    const active = isNavPathActive(location.pathname, path);
                    return (
                  <SidebarMenuButton
                    tooltip={label}
                    asChild
                    isActive={active}
                    size="sm"
                  >
                    <NavLink to={path} end={false}>
                      <Icon
                        className={`size-3.5 shrink-0 transition-all duration-150 group-hover/menu-item:scale-105 ${active ? "opacity-100" : "opacity-45 group-hover/menu-item:opacity-80"}`}
                      />
                      <span
                        className={`text-[11px] transition-opacity duration-150 ${active ? "opacity-100" : "opacity-45 group-hover/menu-item:opacity-80"}`}
                      >
                        {label}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                    );
                  })()}
                </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={t("nav.settings")}
              isActive={onSettings}
              onClick={() => navigate(onSettings ? "/runs" : "/settings")}
              size="sm"
            >
              <Settings
                className={`size-3.5 shrink-0 transition-all duration-150 group-hover/menu-item:scale-105 ${onSettings ? "opacity-100" : "opacity-45 group-hover/menu-item:opacity-80"}`}
              />
              <span
                className={`text-[11px] transition-opacity duration-150 ${onSettings ? "opacity-100" : "opacity-45 group-hover/menu-item:opacity-80"}`}
              >
                {t("nav.settings")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <LangSwitcher onActivate={activate} />
      </SidebarFooter>
    </Sidebar>
  );
}

export function NavSidebar() {
  return <NavSidebarInner />;
}
