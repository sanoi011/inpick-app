"use client";

import { useLocale } from "@/hooks/useLocale";
import { Globe } from "lucide-react";
import type { Locale } from "@/i18n";
import { LOCALE_LABELS } from "@/i18n";

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  const toggle = () => {
    const next: Locale = locale === "ko" ? "en" : "ko";
    setLocale(next);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
      title={`Switch to ${LOCALE_LABELS[locale === "ko" ? "en" : "ko"]}`}
    >
      <Globe className="w-3.5 h-3.5" />
      {locale === "ko" ? "EN" : "KR"}
    </button>
  );
}
