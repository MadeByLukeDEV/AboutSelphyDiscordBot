import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { caseNumberSchema, getCaseDetail } from "@/modules/moderation";
import { CaseDetail } from "@/modules/moderation/components/case-detail";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations("Moderation.detail");
  const number = caseNumberSchema.safeParse((await params).number);
  return { title: number.success ? t("title", { number: number.data }) : t("back") };
}

export default async function CasePage({ params }: Props) {
  const { number } = await params;
  await requireStaffPage(`/cases/${encodeURIComponent(number)}`);

  const parsed = caseNumberSchema.safeParse(number);
  if (!parsed.success) notFound();
  const detail = await getCaseDetail(parsed.data);
  if (!detail) notFound();

  return <CaseDetail row={detail.row} others={detail.others} />;
}
