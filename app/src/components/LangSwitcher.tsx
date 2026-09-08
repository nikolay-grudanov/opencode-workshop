/**
 * F-016: language switcher pill (EN / RU). Mounted in NavSidebar's footer.
 * Calls setLanguage() which persists + dispatches workshop:lang-changed so all
 * subscribed t() hooks re-render immediately.
 */
import { SUPPORTED_LANGUAGES, setLanguage, useT } from "../i18n";

export function LangSwitcher() {
  const { t, language } = useT();
  return (
    <div className="flex items-center gap-1 rounded-md bg-white/[0.04] p-0.5" role="group" aria-label={t("language.switch")}>
      {SUPPORTED_LANGUAGES.map((code) => {
        const active = code === (language.split("-")[0] ?? language);
        return (
          <button
            key={code}
            type="button"
            onClick={() => void setLanguage(code)}
            aria-pressed={active}
            className={`flex-1 rounded-[5px] px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors ${
              active
                ? "bg-white/[0.12] text-white/90"
                : "text-white/45 hover:text-white/75 hover:bg-white/[0.05]"
            }`}
            title={t(code === "en" ? "language.english" : "language.russian")}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
