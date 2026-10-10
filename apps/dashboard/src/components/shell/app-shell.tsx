import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { BotStatusPill } from "@/modules/bot-status";
import { isAdmin, type StaffSession } from "@/modules/auth";
import { AccountPanel } from "./account-panel";
import { MobileAccountSheet } from "./mobile-account-sheet";
import { MobileNav } from "./mobile-nav";
import { navFor } from "./nav";
import { SidebarNav } from "./sidebar-nav";

function Brand({ label }: { label: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Image src="/brand/logo.png" alt="" width={72} height={72} unoptimized priority className="size-9 rounded-xl object-cover shadow-[0_0_1.25rem_-0.25rem_var(--primary)]" />
      {label}
    </Link>
  );
}

// Hiding a nav item is only a convenience: every page and Server Action
// re-checks the role itself.
export async function AppShell({ session, children }: { session: StaffSession; children: React.ReactNode }) {
  const t = await getTranslations("Shell");
  const groups = navFor(isAdmin(session.user.role));

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row lg:gap-4 lg:p-4">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("skipToContent")}
      </a>

      {/* Desktop: a floating glass sidebar. */}
      <aside className="surface hidden w-[17rem] shrink-0 flex-col gap-6 p-4 lg:sticky lg:top-4 lg:flex lg:h-[calc(100dvh-2rem)]">
        <div className="px-1 pt-1">
          <Brand label={t("brand")} />
        </div>
        <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1 pl-3">
          <SidebarNav groups={groups} />
        </div>
        <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
          <BotStatusPill className="self-start" />
          <AccountPanel session={session} />
        </div>
      </aside>

      {/* Phone and tablet: a slim top bar, the tab bar sits at the bottom. */}
      <header className="flex items-center justify-between gap-3 px-gutter pt-4 lg:hidden">
        <Brand label={t("brand")} />
        <div className="flex items-center gap-3">
          <BotStatusPill />
          <MobileAccountSheet name={session.user.name} image={session.user.image}>
            <AccountPanel session={session} />
          </MobileAccountSheet>
        </div>
      </header>

      <main id="content" data-enter className="flex min-w-0 flex-1 flex-col gap-fluid p-gutter pb-28 lg:p-4 lg:pb-4">
        {children}
      </main>

      <MobileNav groups={groups} />
    </div>
  );
}
