-- AlterTable
ALTER TABLE "TempVoiceConfig" ADD COLUMN "rememberSettings" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TempVoicePreference" (
    "userId" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "userLimit" INTEGER NOT NULL DEFAULT 0,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "videoAllowed" BOOLEAN NOT NULL DEFAULT true,
    "soundboardAllowed" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempVoicePreference_pkey" PRIMARY KEY ("userId")
);

-- Discord's own limit for a voice channel is 99 people (0 = no limit).
ALTER TABLE "TempVoicePreference" ADD CONSTRAINT "TempVoicePreference_limit_range" CHECK ("userLimit" BETWEEN 0 AND 99);
