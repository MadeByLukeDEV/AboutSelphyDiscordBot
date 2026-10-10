-- AlterTable
ALTER TABLE "TwitchConfig" ADD COLUMN     "liveRoleId" VARCHAR(20);

-- AlterTable
ALTER TABLE "TwitchStreamer" ADD COLUMN     "discordUserId" VARCHAR(20);

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "TwitchConfig" ADD CONSTRAINT "TwitchConfig_live_role_digits" CHECK ("liveRoleId" IS NULL OR "liveRoleId" ~ '^[0-9]{17,20}$');
ALTER TABLE "TwitchStreamer" ADD CONSTRAINT "TwitchStreamer_discord_user_digits" CHECK ("discordUserId" IS NULL OR "discordUserId" ~ '^[0-9]{17,20}$');
