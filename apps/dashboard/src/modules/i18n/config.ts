// Cookie-based locale, no URL prefix: the dashboard is staff-only, so there is
// nothing for search engines to index (same approach as Main's /admin and the
// Social dashboard).
export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}
