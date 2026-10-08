import { getTranslations } from "next-intl/server";
import { LogOut } from "lucide-react";
import { siteUrl } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { signOutEndpoint } from "../session";

// A plain cross-origin form POST to the central auth service: it owns the
// session, signs out of every aboutselphy surface at once and sends the
// browser back here. No client JS needed. The CSP allows it via form-action
// (src/lib/security/csp.ts).
export async function SignOutButton() {
  const t = await getTranslations("Shell");

  return (
    <form method="post" action={signOutEndpoint()}>
      <input type="hidden" name="redirect" value={siteUrl()} />
      <Button type="submit" variant="outline" size="sm" className="w-full">
        <LogOut aria-hidden />
        {t("signOut")}
      </Button>
    </form>
  );
}
