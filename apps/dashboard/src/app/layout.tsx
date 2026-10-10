import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { clientMessages } from "@/modules/i18n/client-messages";
import { ThemeProvider } from "@/modules/theme";
import { Toaster } from "@/components/ui/sonner";
import { fontSans } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AboutSelphy Bot", template: "%s — AboutSelphy Bot" },
  description: "Staff dashboard for the AboutSelphy Discord bot.",
  // Staff-only: keep it out of search results.
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers() makes every page render per request, which the nonce CSP
  // needs: static HTML can't carry a per-request nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = await getLocale();
  // Add a namespace here whenever a client component uses useTranslations("X").
  const messages = await clientMessages(["Shell", "ThemeToggle","LocaleSwitcher", "BotStatus", "Moderation", "TempVoice", "Twitch", "Youtube", "Announcements", "Roles", "Welcome", "Logs", "Levels", "Tickets", "Errors"]);

  return (
    <html lang={locale} className={fontSans.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider nonce={nonce}>
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
