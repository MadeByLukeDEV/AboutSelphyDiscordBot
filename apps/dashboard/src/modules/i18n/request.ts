import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";

// NEXT_LOCALE cookie (set by the switcher) wins; otherwise the browser's
// Accept-Language; otherwise English.
async function detectLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const preferred = ((await headers()).get("accept-language") ?? "")
    .split(",")
    .map((part) => part.split(";")[0]!.trim().split("-")[0]!.toLowerCase());
  return preferred.find(isLocale) ?? DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // Explicit: otherwise next-intl uses the server's zone (UTC in Docker).
    timeZone: "Europe/Vienna",
  };
});
