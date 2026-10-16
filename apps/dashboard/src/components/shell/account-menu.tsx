"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "./avatar";

/** Desktop: the signed-in member in the top bar; the account panel (theme, language, sign-out) opens under it. The panel is rendered on the server and passed in. */
export function AccountMenu({ name, image, children }: { name: string; image: string | null; children: React.ReactNode }) {
  const t = useTranslations("Shell");
  return (
    <Popover>
      <PopoverTrigger aria-label={t("account.open")} className="flex items-center gap-2 rounded-full border bg-background/40 py-1 pr-3 pl-1 text-sm font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <Avatar name={name} image={image} className="size-7 text-xs" />
        <span className="max-w-[10rem] truncate">{name}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 gap-3 p-4">
        {children}
      </PopoverContent>
    </Popover>
  );
}
