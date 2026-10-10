"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar } from "./avatar";

/** On a phone the account block lives behind the avatar in the top bar. The panel is rendered on the server and passed in. */
export function MobileAccountSheet({ name, image, children }: { name: string; image: string | null; children: React.ReactNode }) {
  const t = useTranslations("Shell");

  return (
    <Sheet>
      <SheetTrigger
        aria-label={t("account.open")}
        className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Avatar name={name} image={image} className="size-9" />
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{t("account.title")}</SheetTitle>
          <SheetDescription className="sr-only">{t("account.description")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-2">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
