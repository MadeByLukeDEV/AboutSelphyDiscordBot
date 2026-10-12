// Private to the webhooks module: only service.ts imports this.
import { prisma, type OutboundWebhook } from "@aboutselphy/db";
import { AUTO_DISABLE_AFTER } from "./rules";

export const listEnabledFor = (event: string): Promise<OutboundWebhook[]> => prisma.outboundWebhook.findMany({ where: { enabled: true, events: { has: event } } });
export const findOutbound = (id: string): Promise<OutboundWebhook | null> => prisma.outboundWebhook.findUnique({ where: { id } });
/**
 * Remembers the result of a delivery. A success resets the failure streak; a real failure (`countsTowardsDisable`, not a test)
 * adds one, and at AUTO_DISABLE_AFTER in a row the webhook is switched off (one conditional UPDATE). Returns true if this call switched it off.
 */
export async function recordResult(id: string, lastStatus: string, countsTowardsDisable: boolean): Promise<boolean> {
  const base = { lastStatus: lastStatus.slice(0, 24), lastAt: new Date() };
  if (lastStatus === "ok") {
    await prisma.outboundWebhook.updateMany({ where: { id }, data: { ...base, failStreak: 0 } });
    return false;
  }
  if (!countsTowardsDisable) {
    await prisma.outboundWebhook.updateMany({ where: { id }, data: base });
    return false;
  }
  await prisma.outboundWebhook.updateMany({ where: { id }, data: { ...base, failStreak: { increment: 1 } } });
  const { count } = await prisma.outboundWebhook.updateMany({ where: { id, enabled: true, failStreak: { gte: AUTO_DISABLE_AFTER } }, data: { enabled: false, autoDisabledAt: new Date() } });
  return count > 0;
}
