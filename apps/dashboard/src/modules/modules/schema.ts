import type { ModuleKey } from "@aboutselphy/shared/modules";

// Types shared by the service, the actions and the client components. No server-only imports.

export type ModuleState = { key: ModuleKey; enabled: boolean };
export type ModulesError = "forbidden" | "invalid" | "failed";
export type SetModuleResult = { ok: true; botNotified: boolean } | { ok: false; error: ModulesError };
