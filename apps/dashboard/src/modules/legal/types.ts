// The legal documents are structured text, not Markdown or HTML: the page renders every part as plain
// text, so nothing here can inject markup.

export type Block = string | { list: string[] };
export type Section = { id: string; heading: string; blocks: Block[] };
export type LegalDoc = { title: string; intro: string; sections: Section[] };
export type LegalKind = "terms" | "privacy";

/** Who runs the bot. Comes from the environment (LEGAL_*), never from code. A missing value shows as a visible placeholder. */
export type Operator = { name: string; address: string; email: string; country: string; hosting: string };

/** Bump this date whenever the wording of either document changes. */
export const LEGAL_LAST_UPDATED = "2026-10-27";
