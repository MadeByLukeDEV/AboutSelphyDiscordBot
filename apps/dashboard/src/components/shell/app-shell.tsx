import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Bot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LocaleSwitcher } from "@/modules/i18n/components/locale-switcher";
import { ThemeToggle } from "@/modules/theme";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { isAdmin, type StaffSession } from "@/modules/auth";
import { NAV_ITEMS } from "./nav";

// Hiding a nav item is only a convenience: every page and Server Action
// re-checks the role itself.
export async function AppShell({
  session,
  children,
}: {
  session: StaffSession;
  children: React.ReactNode;
}) {
  const t = await getTranslations("Shell");
  const items = NAV_ITEMS.filter((item) => !item.requires || isAdmin(session.user.role));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>

      <aside className="flex flex-col gap-4 border-b bg-card px-gutter py-4 md:sticky md:top-0 md:h-dvh md:w-[16rem] md:shrink-0 md:border-r md:border-b-0 md:px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-4" aria-hidden />
          </span>
          {t("brand")}
        </Link>

        <nav aria-label={t("nav.label")} className="flex gap-1 md:flex-col">
          {items.map(({ href, labelKey, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Icon className="size-4" aria-hidden />
              {t(`nav.${labelKey}`)}
            </Link>
          ))}
        </nav>

        <div className="mt-auto hidden flex-col gap-3 md:flex">
          <Separator />
          <AccountBlock session={session} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="content" data-enter className="flex flex-1 flex-col gap-fluid p-gutter">
          {children}
        </main>
        <div className="flex flex-col gap-3 border-t px-gutter py-4 md:hidden">
          <AccountBlock session={session} />
        </div>
      </div>
    </div>
  );
}

async function AccountBlock({ session }: { session: StaffSession }) {
  const t = await getTranslations("Shell");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="truncate text-sm font-medium">{session.user.name}</p>
        <div>
          <Badge variant={isAdmin(session.user.role) ? "default" : "secondary"}>
            {t(`role.${session.user.role}`)}
          </Badge>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
      <SignOutButton />
    </div>
  );
}
