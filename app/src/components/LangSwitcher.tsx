/**
 * F-018: language switcher as a globe-only rail button. The sidebar never
 * expands for it — languages live in a small flyout menu that opens on hover
 * (with a short intent delay) or click, and closes on mouse-leave (grace
 * delay), Escape, outside pointerdown, or focus leaving the widget. Languages
 * are listed as endonyms with a check on the active one (W3C i18n guidance).
 *
 * The flyout is absolutely positioned (no portal): the sidebar container has
 * no overflow-hidden, so the menu can escape the collapsed 48px rail and
 * overlay the content area.
 */
import { Check, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LANGUAGES, getLanguage, setLanguage, useT } from "../i18n";

/** locale code → i18n key holding the language endonym ("Русский", "English"). */
const ENDONYM_KEYS: Record<string, string> = {
  en: "language.english",
  ru: "language.russian",
};

const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 250;

export function LangSwitcher() {
  const { t } = useT();
  const language = getLanguage().split("-")[0] ?? "en";
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);

  const cancelTimers = () => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  };

  const scheduleOpen = () => {
    cancelTimers();
    openTimer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  };

  const scheduleClose = () => {
    cancelTimers();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    []
  );

  // While open: outside pointerdown and Escape dismiss the menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const pick = (lang: string) => {
    cancelTimers();
    setOpen(false);
    buttonRef.current?.focus();
    if (lang !== language) void setLanguage(lang);
  };

  return (
    <div ref={wrapperRef} className="relative" onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          cancelTimers();
          setOpen((v) => !v);
        }}
        title={t("language.switch")}
        aria-label={t("language.switch")}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-full items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white/95"
      >
        <Globe className="size-3.5 shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t("language.switch")}
          className="absolute bottom-full left-0 z-50 mb-1 w-36 rounded-md border border-white/10 bg-sidebar p-1 shadow-lg"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="menuitem"
              onClick={() => pick(lang)}
              className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-xs text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <span>{t(ENDONYM_KEYS[lang] ?? lang)}</span>
              {lang === language && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
