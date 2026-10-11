import "server-only";
import { operator } from "./config";
import { privacyDe } from "./privacy.de";
import { privacyEn } from "./privacy.en";
import { termsDe } from "./terms.de";
import { termsEn } from "./terms.en";
import type { LegalDoc, LegalKind } from "./types";

export { LEGAL_LAST_UPDATED } from "./types";
export type { LegalDoc, LegalKind } from "./types";

/** The document in the visitor's language (German or English; anything else gets English). */
export function getLegalDoc(kind: LegalKind, locale: string): LegalDoc {
  const o = operator();
  const de = locale === "de";
  return kind === "privacy" ? (de ? privacyDe(o) : privacyEn(o)) : de ? termsDe(o) : termsEn(o);
}

/** Does any of the operator's details still show a placeholder? (The page logs this so it can't go unnoticed.) */
export const operatorIsComplete = (): boolean => !Object.values(operator()).some((v) => v.startsWith("[") && v.endsWith("is not set]"));
