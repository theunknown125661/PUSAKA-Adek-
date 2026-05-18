"use client";

import { useState, useEffect } from "react";
import type { Locale, Messages } from "./types";
import { en } from "./en";
import { id } from "./id";
import { defaultLocale } from "./types";

const dictionaries: Record<Locale, Messages> = { en, id };

// A simple local storage based language toggle
export function useTranslation() {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem("app-locale") as Locale;
    if (saved && (saved === "en" || saved === "id")) {
      setLocale(saved);
    }
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("app-locale", newLocale);
  };

  const t = dictionaries[locale];

  // Helper to safely interpolate variables into strings like "Next badge at {count}"
  const interpolate = (text: string, values: Record<string, string | number>) => {
    return Object.entries(values).reduce((acc, [key, value]) => {
      return acc.replace(new RegExp(`{${key}}`, "g"), String(value));
    }, text);
  };

  return { t, locale, changeLocale, isClient, interpolate };
}
