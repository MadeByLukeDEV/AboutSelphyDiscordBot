// Private to the autopublish module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

export async function listPublishChannels(): Promise<string[]> {
  return (await prisma.autoPublishChannel.findMany({ select: { channelId: true } })).map((r) => r.channelId);
}
