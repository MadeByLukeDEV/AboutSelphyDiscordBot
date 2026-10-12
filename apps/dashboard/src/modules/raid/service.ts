import "server-only";
import type { RaidConfig } from "@aboutselphy/db";
import { RAID_ACTIONS, type RaidSettings } from "@aboutselphy/shared/entry";
import { errorInfo } from "@/lib/log";
import { reloadBotModule } from "@/modules/bot-api";
import { readConfig, updateConfig } from "./repository";
import type { RaidState, SaveRaidResult } from "./schema";

const toSettings = (c: RaidConfig): RaidSettings => ({
  enabled: c.enabled,
  joinThreshold: c.joinThreshold,
  windowSeconds: c.windowSeconds,
  action: (RAID_ACTIONS as readonly string[]).includes(c.action) ? (c.action as RaidSettings["action"]) : "alert",
  actionMinutes: c.actionMinutes,
  raidMinutes: c.raidMinutes,
});

export async function getRaidPage() {
  const config = await readConfig();
  const state: RaidState = { activeUntil: config.activeUntil && config.activeUntil.getTime() > Date.now() ? config.activeUntil.toISOString() : null, lastRaidAt: config.lastRaidAt?.toISOString() ?? null };
  return { settings: toSettings(config), state };
}

export async function saveRaid(input: RaidSettings): Promise<SaveRaidResult> {
  try {
    const saved = await updateConfig(input);
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("raid") };
  } catch (error) {
    console.error("[raid] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
