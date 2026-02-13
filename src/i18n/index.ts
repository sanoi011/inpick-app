import ko from "./ko.json";
import en from "./en.json";

export type Locale = "ko" | "en";
export type Messages = typeof ko;

const messages: Record<Locale, Messages> = { ko, en };

export function getMessages(locale: Locale): Messages {
  return messages[locale] || messages.ko;
}

export const LOCALE_LABELS: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

export const DEFAULT_LOCALE: Locale = "ko";
