/**
 * F-016: i18n infrastructure (react-i18next + browser-languagedetector).
 *
 * - ensureI18n(language?): mounts the singleton i18next instance and switches
 *   language. Idempotent; safe to call from any component.
 * - useT(): thin hook over `useTranslation()` exposing `t()` with our default
 *   `translation` namespace. Subscribes to `workshop:lang-changed` so component
 *   trees re-render when language switches outside React (e.g. via LangSwitcher).
 * - window.__workshopT: a translation function pointer attached to globalThis
 *   after init, so non-React contexts (F-015 TraceDebugPrompt, future console
 *   bridges) can resolve i18n keys without depending on the React hook.
 *
 * Persistence: `localStorage["workshop:lang"]`. Detection order: explicit user
 * choice → `navigator.language` → `"en"`.
 */

import { useCallback, useEffect, useState } from "react";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next, useTranslation } from "react-i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

const STORAGE_KEY = "workshop:lang";
const SUPPORTED = ["en", "ru"] as const;
type Supported = (typeof SUPPORTED)[number];

let initialized = false;

declare global {
  var __workshopT: ((key: string, opts?: Record<string, unknown>) => string) | undefined;
}

function persist(lang: string) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

function readPersisted(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function detectInitial(): string {
  const persisted = readPersisted();
  if (persisted && (SUPPORTED as readonly string[]).includes(persisted)) return persisted;
  if (typeof navigator !== "undefined") {
    const lang = navigator.language?.split("-")[0] ?? "";
    if ((SUPPORTED as readonly string[]).includes(lang)) return lang;
  }
  return "en";
}

function bindGlobalT() {
  if (typeof window === "undefined") return;
  globalThis.__workshopT = (key: string, opts?: Record<string, unknown>) =>
    i18n.t(key, opts ?? {}) as string;
}

/** Mount the singleton i18next. Idempotent. */
export async function ensureI18n(language?: string): Promise<typeof i18n> {
  if (!initialized) {
    await i18n
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        resources: { en: { translation: en }, ru: { translation: ru } },
        lng: language ?? detectInitial(),
        fallbackLng: "en",
        supportedLngs: SUPPORTED as unknown as string[],
        interpolation: { escapeValue: false },
        detection: {
          order: ["localStorage", "navigator"],
          lookupLocalStorage: STORAGE_KEY,
          caches: ["localStorage"],
        },
        returnNull: false,
      });
    initialized = true;
  } else if (language && i18n.language !== language) {
    await i18n.changeLanguage(language);
    persist(language);
  }
  bindGlobalT();
  return i18n;
}

/** Switch language at runtime; persists and dispatches a change event. */
export async function setLanguage(language: string): Promise<void> {
  await ensureI18n();
  if (!(SUPPORTED as readonly string[]).includes(language)) return;
  await i18n.changeLanguage(language);
  persist(language);
  bindGlobalT();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("workshop:lang-changed", { detail: { language } }));
  }
}

export function getLanguage(): string {
  return i18n.language ?? "en";
}

export const SUPPORTED_LANGUAGES = SUPPORTED;

/**
 * React hook returning a `t` function bound to the current language.
 * Subscribes to `workshop:lang-changed` so calling components re-render when
 * the language switches (e.g. via LangSwitcher).
 */
export function useT(): {
  t: (key: string, opts?: Record<string, unknown>) => string;
  i18n: typeof i18n;
  language: string;
} {
  const { t: rawT, i18n: instance } = useTranslation();
  const [, force] = useState(0);
  useEffect(() => {
    const handler = () => force((n) => n + 1);
    window.addEventListener("workshop:lang-changed", handler);
    return () => window.removeEventListener("workshop:lang-changed", handler);
  }, []);
  const t = useCallback(
    (key: string, opts?: Record<string, unknown>) => rawT(key, opts ?? {}) as string,
    [rawT],
  );
  return { t, i18n: instance, language: instance.language };
}
