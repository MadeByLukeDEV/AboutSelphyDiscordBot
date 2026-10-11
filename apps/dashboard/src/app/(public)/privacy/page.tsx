import { getLocale, getTranslations } from "next-intl/server";
import { getLegalDoc, LEGAL_LAST_UPDATED } from "@/modules/legal";
import { LegalDocument } from "@/modules/legal/components/legal-document";

export async function generateMetadata() {
  return { title: (await getTranslations("Legal"))("privacyTitle") };
}

export default async function PrivacyPage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Legal")]);
  return <LegalDocument doc={getLegalDoc("privacy", locale)} updated={LEGAL_LAST_UPDATED} other={{ href: "/terms", label: t("readTerms") }} />;
}
