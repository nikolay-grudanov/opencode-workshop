/**
 * F-016: language switcher. Renders as a compact single pill that fits the
 * collapsed sidebar (~47px wide) AND the expanded sidebar. Shows the current
 * language as the visible label; hovering expands to show the other option.
 *
 * Click cycles to the other language; persists + dispatches workshop:lang-changed.
 */
import { Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES, getLanguage, setLanguage, useT } from "../i18n";

export function LangSwitcher() {
  const { t } = useT();
  const language = getLanguage().split("-")[0] ?? "en";
  const other = SUPPORTED_LANGUAGES.find((c) => c !== language) ?? "en";
  return (
    <button
      type="button"
      onClick={() => void setLanguage(other)}
      title={`${t("language.switch")} (${language.toUpperCase()} → ${other.toUpperCase()})`}
      aria-label={t("language.switch")}
      className="group/switch flex w-full items-center justify-center gap-1 rounded-md bg-white/[0.04] px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white/95"
    >
      <Globe className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover/switch:opacity-100" aria-hidden="true" />
      <span className="font-mono">{language}</span>
      <span aria-hidden="true" className="text-white/30 transition-colors group-hover/switch:text-white/60">
        /
      </span>
      <span aria-hidden="true" className="text-white/30 transition-colors group-hover/switch:text-white/95">
        {other}
      </span>
    </button>
  );
}
