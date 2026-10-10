import "server-only";
// Private to the webhooks module: only service.ts and the public endpoint's helper import this.
import { prisma } from "@aboutselphy/db";

export const listEndpoints = () => prisma.webhookEndpoint.findMany({ orderBy: { createdAt: "asc" } });
export const findEndpoint = (id: string) => prisma.webhookEndpoint.findUnique({ where: { id } });
export const countEndpoints = () => prisma.webhookEndpoint.count();
export const createEndpoint = (data: { name: string; channelId: string; secretEnc: string; enabled: boolean; createdByName: string }) => prisma.webhookEndpoint.create({ data });
export const updateEndpoint = (id: string, data: { name?: string; channelId?: string; enabled?: boolean; secretEnc?: string }) => prisma.webhookEndpoint.update({ where: { id }, data });
export const deleteEndpoint = async (id: string) => (await prisma.webhookEndpoint.deleteMany({ where: { id } })).count;
export const countUse = (id: string) => prisma.webhookEndpoint.updateMany({ where: { id }, data: { uses: { increment: 1 }, lastUsedAt: new Date() } });

export const listOutbound = () => prisma.outboundWebhook.findMany({ orderBy: { createdAt: "asc" } });
export const findOutbound = (id: string) => prisma.outboundWebhook.findUnique({ where: { id } });
export const countOutbound = () => prisma.outboundWebhook.count();
export const createOutbound = (data: { name: string; kind: string; urlEnc: string; secretEnc: string | null; events: string[]; enabled: boolean; createdByName: string }) => prisma.outboundWebhook.create({ data });
export const updateOutbound = (id: string, data: { name: string; events: string[]; enabled: boolean; urlEnc?: string }) => prisma.outboundWebhook.update({ where: { id }, data });
export const deleteOutbound = async (id: string) => (await prisma.outboundWebhook.deleteMany({ where: { id } })).count;
