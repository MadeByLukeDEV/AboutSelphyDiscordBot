import "server-only";
import { env } from "@/lib/env";
import type { Operator } from "./types";

const missing = (name: string) => `[${name} is not set]`;

/** The operator's details from LEGAL_* variables. A value that isn't set shows as a clearly visible placeholder, never as a guess. */
export function operator(): Operator {
  const e = env();
  return {
    name: e.LEGAL_OPERATOR_NAME || missing("LEGAL_OPERATOR_NAME"),
    address: e.LEGAL_OPERATOR_ADDRESS || missing("LEGAL_OPERATOR_ADDRESS"),
    email: e.LEGAL_CONTACT_EMAIL || missing("LEGAL_CONTACT_EMAIL"),
    country: e.LEGAL_COUNTRY || missing("LEGAL_COUNTRY"),
    hosting: e.LEGAL_HOSTING || missing("LEGAL_HOSTING"),
  };
}
