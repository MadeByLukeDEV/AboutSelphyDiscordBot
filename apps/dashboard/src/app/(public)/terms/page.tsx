import { getLocale, getTranslations } from "next-intl/server";
import { getLegalDoc, LEGAL_LAST_UPDATED } from "@/modules/legal";
import { LegalDocument } from "@/modules/legal/components/legal-document";

export async function generateMetadata() {
  return { title: (await getTranslations("Legal"))("termsTitle") };
}

export default async function TermsPage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Legal")]);
  return <LegalDocument doc={getLegalDoc("terms", locale)} updated={LEGAL_LAST_UPDATED} other={{ href: "/privacy", label: t("readPrivacy") }} />;
}
