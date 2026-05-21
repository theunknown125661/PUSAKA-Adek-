"use client";

import { useState, useEffect, useCallback } from "react";
import type { Locale, Messages } from "./types";
import { en } from "./en";
import { id } from "./id";
import { defaultLocale } from "./types";

const dictionaries: Record<Locale, Messages> = { en, id };

/** Read the saved locale synchronously — safe because all consumer components
 *  are "use client" and this runs only in the browser after hydration. */
function getInitialLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  try {
    const saved = localStorage.getItem("app-locale");
    if (saved === "en" || saved === "id") return saved;
  } catch {
    // localStorage may be blocked in some sandbox environments
  }
  return defaultLocale;
}

// A simple local storage based language toggle
export function useTranslation() {
  // Lazy initializer: reads localStorage synchronously so the correct locale
  // is used on the FIRST render — no English flash before switching.
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Sync again in case localStorage changed in another tab/window
    const saved = localStorage.getItem("app-locale") as Locale;
    if (saved && (saved === "en" || saved === "id") && saved !== locale) {
      setLocale(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also listen for storage events (cross-tab locale change)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === "app-locale" && (e.newValue === "en" || e.newValue === "id")) {
        setLocale(e.newValue as Locale);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("app-locale", newLocale);
  }, []);

  const t = dictionaries[locale];

  // Helper to safely interpolate variables into strings like "Next badge at {count}"
  const interpolate = useCallback((text: string, values: Record<string, string | number>) => {
    return Object.entries(values).reduce((acc, [key, value]) => {
      return acc.replace(new RegExp(`{${key}}`, "g"), String(value));
    }, text);
  }, []);

  return { t, locale, changeLocale, isClient, interpolate };
}
