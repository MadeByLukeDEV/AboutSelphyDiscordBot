import "server-only";
import { MODULE_KEYS, type ModuleKey } from "@aboutselphy/shared/modules";
import { errorInfo } from "@/lib/log";
import { reloadBotModule } from "@/modules/bot-api";
import { listFlags, setFlag } from "./repository";
import type { ModuleState, SetModuleResult } from "./schema";

/** Every switchable feature with its state (a feature without a row is on). */
export async function getModulesPage(): Promise<{ modules: ModuleState[] }> {
  const flags = new Map((await listFlags()).map((f) => [f.key, f.enabled]));
  return { modules: MODULE_KEYS.map((key) => ({ key, enabled: flags.get(key) ?? true })) };
}

export async function setModule(key: ModuleKey, enabled: boolean, byName: string): Promise<SetModuleResult> {
  try {
    await setFlag(key, enabled, byName.slice(0, 100));
    console.info("[modules] switched", { key, enabled, by: byName });
    return { ok: true, botNotified: await reloadBotModule("modules") };
  } catch (error) {
    console.error("[modules] switching failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
