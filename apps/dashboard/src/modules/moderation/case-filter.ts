import type { Prisma } from "@aboutselphy/db";
import type { CaseQuery } from "./schema";

const DIGITS = /^\d+$/;

/**
 * The Prisma filter for the cases page. Pure (no database, no server-only), so
 * it is unit-tested. What the search box accepts:
 *  - 17+ digits: a Discord ID, matching the member or the moderator
 *  - up to 9 digits: a case number
 *  - anything else: free text in names and reason, case-insensitive
 * Prisma parameterises every value; nothing is concatenated into SQL.
 */
export function caseWhere({ type, q }: Pick<CaseQuery, "type" | "q">): Prisma.ModCaseWhereInput {
  const where: Prisma.ModCaseWhereInput = {};
  if (type) where.type = type;
  if (!q) return where;

  if (DIGITS.test(q)) {
    if (q.length >= 17) return { ...where, OR: [{ targetId: q }, { moderatorId: q }] };
    if (q.length <= 9) return { ...where, OR: [{ caseNumber: Number(q) }] };
  }

  return {
    ...where,
    OR: [
      { targetName: { contains: q, mode: "insensitive" } },
      { moderatorName: { contains: q, mode: "insensitive" } },
      { reason: { contains: q, mode: "insensitive" } },
    ],
  };
}

/** The same query as URL params, omitting defaults, for links and the filter form. */
export function caseQueryString(query: Partial<Pick<CaseQuery, "type" | "q" | "page">>): string {
  const params = new URLSearchParams();
  if (query.type) params.set("type", query.type);
  if (query.q) params.set("q", query.q);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}
