// Private to the webhooks module: only service.ts imports this.
import { prisma, type OutboundWebhook } from "@aboutselphy/db";

export const listEnabledFor = (event: string): Promise<OutboundWebhook[]> => prisma.outboundWebhook.findMany({ where: { enabled: true, events: { has: event } } });
export const findOutbound = (id: string): Promise<OutboundWebhook | null> => prisma.outboundWebhook.findUnique({ where: { id } });
export const recordResult = (id: string, lastStatus: string) => prisma.outboundWebhook.updateMany({ where: { id }, data: { lastStatus: lastStatus.slice(0, 24), lastAt: new Date() } });
