import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { LocaleSwitcher } from "@/modules/i18n/components/locale-switcher";
import { ThemeToggle } from "@/modules/theme";
import { SignOutButton } from "@/modules/auth/components/sign-out-button";
import { isAdmin, type StaffSession } from "@/modules/auth";
import { Avatar } from "./avatar";

/** Who is signed in, the two preferences and sign-out. Shown in the sidebar and in the phone's account sheet. */
export async function AccountPanel({ session }: { session: StaffSession }) {
  const t = await getTranslations("Shell");
  const { name, image, role } = session.user;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} image={image} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <div>
            <Badge variant={isAdmin(role) ? "default" : "secondary"}>{t(`role.${role}`)}</Badge>
          </div>
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
