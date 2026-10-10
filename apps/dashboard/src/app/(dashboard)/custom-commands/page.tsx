import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MAX_CUSTOM_COMMANDS } from "@aboutselphy/shared/custom-commands";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getCustomCommandsPage } from "@/modules/custom-commands";
import { CustomCommandsManager } from "@/modules/custom-commands/components/custom-commands-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("CustomCommands"))("title") };
}

export default async function CustomCommandsPage() {
  const session = await requireStaffPage("/custom-commands");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("CustomCommands");
  const { commands } = await getCustomCommandsPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <CustomCommandsManager commands={commands} max={MAX_CUSTOM_COMMANDS} />
    </>
  );
}
