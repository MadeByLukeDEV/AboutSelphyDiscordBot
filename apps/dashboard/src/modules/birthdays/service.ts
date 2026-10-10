import "server-only";
import type { BirthdayConfig } from "@aboutselphy/db";
import type { BirthdaySettings } from "@aboutselphy/shared/birthdays";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { getCardImageView } from "@/modules/member-cards";
import { allBirthdays, readConfig, updateConfig } from "./repository";
import type { BirthdayRow, SaveBirthdayResult } from "./schema";

const toSettings = (c: BirthdayConfig): BirthdaySettings => ({ enabled: c.enabled, channelId: c.channelId ?? "", roleId: c.roleId ?? "", message: c.message, timeZone: c.timeZone, cardEnabled: c.cardEnabled, cardMode: c.cardMode === "sticker" ? "sticker" : "background", cardTitle: c.cardTitle, cardSubtitle: c.cardSubtitle });

/** Today's date in a time zone, as year/month/day. */
function todayIn(timeZone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const utcDay = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 86_400_000;

/** Days until the next celebration; 29 February is celebrated on the 28th in common years (same rule as the bot). */
function daysUntil(b: { month: number; day: number }, t: { year: number; month: number; day: number }): number {
  for (const year of [t.year, t.year + 1]) {
    const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
    const diff = utcDay(year, b.month, day) - utcDay(t.year, t.month, t.day);
    if (diff >= 0) return diff;
  }
  return 366;
}

/** Settings, the next birthdays, and the channels and roles to pick from (null = bot unreachable). */
export async function getBirthdaysPage() {
  const [config, rows, channels, roles, cardImage] = await Promise.all([readConfig(), allBirthdays(), listChannels(["text"]), listRoles(), getCardImageView("birthday")]);
  const today = todayIn(config.timeZone);
  const birthdays: BirthdayRow[] = rows
    .map((b) => ({ userId: b.userId, name: b.displayName, month: b.month, day: b.day, inDays: daysUntil(b, today) }))
    .sort((a, b) => a.inDays - b.inDays)
    .slice(0, 50);
  return { settings: toSettings(config), birthdays, total: rows.length, channels, roles, cardImage };
}

/** Saves the settings. A changed channel or role must exist in the server (checked through the bot; refused if it can't answer). */
export async function saveBirthdays(input: BirthdaySettings): Promise<SaveBirthdayResult> {
  try {
    const current = await readConfig();
    if ((input.channelId && input.channelId !== current.channelId) || (input.roleId && input.roleId !== current.roleId)) {
      const [channels, roles] = await Promise.all([listChannels(["text"]), listRoles()]);
      if (!channels || !roles) return { ok: false, error: "botUnavailable" };
      if (input.channelId && input.channelId !== current.channelId && !channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
      if (input.roleId && input.roleId !== current.roleId && !roles.some((r) => r.id === input.roleId && r.assignable)) return { ok: false, error: "roleNotFound" };
    }
    const saved = await updateConfig({ enabled: input.enabled, channelId: input.channelId || null, roleId: input.roleId || null, message: input.message, timeZone: input.timeZone, cardEnabled: input.cardEnabled, cardMode: input.cardMode, cardTitle: input.cardTitle, cardSubtitle: input.cardSubtitle });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("birthdays") };
  } catch (error) {
    console.error("[birthdays] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
