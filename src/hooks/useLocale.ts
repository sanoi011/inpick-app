"use client";

import { useState, useEffect, useCallback } from "react";
import { getMessages, DEFAULT_LOCALE } from "@/i18n";
import type { Locale, Messages } from "@/i18n";

const STORAGE_KEY = "inpick_locale";

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Messages>(getMessages(DEFAULT_LOCALE));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved && (saved === "ko" || saved === "en")) {
        setLocaleState(saved);
        setMessages(getMessages(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setMessages(getMessages(newLocale));
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: string): string => getNestedValue(messages as unknown as Record<string, unknown>, key),
    [messages]
  );

  return { locale, setLocale, t, messages };
}
