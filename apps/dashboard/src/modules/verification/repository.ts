import "server-only";
// Private to the verification module: only service.ts imports this.
import { prisma, type VerificationConfig } from "@aboutselphy/db";

export const readConfig = (): Promise<VerificationConfig> => prisma.verificationConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export type ConfigData = {
  enabled: boolean;
  channelId: string | null;
  verifiedRoleId: string | null;
  unverifiedRoleId: string | null;
  panelTitle: string;
  panelDescription: string;
  buttonLabel: string;
  question: string;
  answer: string;
  minAccountAgeDays: number;
  kickAfterHours: number;
  /** Set only when the gate is switched on now. */
  enabledAt?: Date;
};

export const updateConfig = (data: ConfigData): Promise<VerificationConfig> => prisma.verificationConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
