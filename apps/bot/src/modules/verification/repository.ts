// Private to the verification module: only config.ts and service.ts import this.
import { prisma, type VerificationConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<VerificationConfig> => prisma.verificationConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const setPanelMessage = (panelMessageId: string) => prisma.verificationConfig.update({ where: { id: 1 }, data: { panelMessageId } });
