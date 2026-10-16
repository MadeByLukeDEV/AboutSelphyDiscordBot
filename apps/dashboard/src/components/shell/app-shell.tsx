import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { BotStatusPill } from "@/modules/bot-status";
import { isAdmin, type StaffSession } from "@/modules/auth";
import { AccountMenu } from "./account-menu";
import { AccountPanel } from "./account-panel";
import { Breadcrumb } from "./breadcrumb";
import { CommandPalette, PaletteTrigger } from "./command-palette";
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
//
// Layout: on a desktop the sidebar only navigates; everything about "me and the bot" (search, bot status, account) sits in a
// slim top bar next to the page, so the sidebar stays calm and the page gets the width. Ctrl+K opens a search over all pages.
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
      <CommandPalette groups={groups} />

      {/* Desktop: a floating glass sidebar that only navigates. */}
      <aside className="surface hidden w-[16rem] shrink-0 flex-col gap-5 p-4 lg:sticky lg:top-4 lg:flex lg:h-[calc(100dvh-2rem)]">
        <div className="px-1 pt-1">
          <Brand label={t("brand")} />
        </div>
        <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1 pl-3">
          <SidebarNav groups={groups} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Desktop top bar: where am I, search, is the bot alive, who am I. */}
        <div className="surface sticky top-4 z-30 hidden items-center justify-between gap-4 px-4 py-2.5 lg:flex">
          <Breadcrumb groups={groups} />
          <div className="flex items-center gap-3">
            <PaletteTrigger />
            <BotStatusPill />
            <AccountMenu name={session.user.name} image={session.user.image}>
              <AccountPanel session={session} />
            </AccountMenu>
          </div>
        </div>

        {/* Phone and tablet: a slim top bar, the tab bar sits at the bottom. */}
        <header className="flex items-center justify-between gap-3 px-gutter pt-4 lg:hidden">
          <Brand label={t("brand")} />
          <div className="flex items-center gap-2">
            <PaletteTrigger compact />
            <BotStatusPill />
            <MobileAccountSheet name={session.user.name} image={session.user.image}>
              <AccountPanel session={session} />
            </MobileAccountSheet>
          </div>
        </header>

        <main id="content" data-enter className="flex min-w-0 flex-1 flex-col gap-fluid p-gutter pb-28 lg:p-0 lg:pb-4">
          {children}
        </main>
      </div>

      <MobileNav groups={groups} />
    </div>
  );
}
