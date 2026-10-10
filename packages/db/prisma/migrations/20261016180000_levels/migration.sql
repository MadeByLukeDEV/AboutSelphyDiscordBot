-- CreateTable
CREATE TABLE "LevelConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "xpMin" INTEGER NOT NULL DEFAULT 15,
    "xpMax" INTEGER NOT NULL DEFAULT 25,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "voiceXpPerMinute" INTEGER NOT NULL DEFAULT 5,
    "announce" VARCHAR(8) NOT NULL DEFAULT 'same',
    "announceChannelId" VARCHAR(20),
    "announceTemplate" VARCHAR(300) NOT NULL DEFAULT 'GG {user}, you reached level {level}!',
    "noXpChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "noXpRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stackRoles" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelReward" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleId" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberXp" (
    "userId" VARCHAR(20) NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,
    "voiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "name" VARCHAR(100) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberXp_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LevelReward_level_key" ON "LevelReward"("level");

-- CreateIndex
CREATE INDEX "MemberXp_xp_idx" ON "MemberXp"("xp");


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_xp_range" CHECK ("xpMin" >= 1 AND "xpMax" >= "xpMin" AND "xpMax" <= 100);
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_cooldown_range" CHECK ("cooldownSeconds" BETWEEN 0 AND 3600);
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_voice_range" CHECK ("voiceXpPerMinute" BETWEEN 0 AND 50);
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_announce_mode" CHECK ("announce" IN ('off', 'same', 'channel'));
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_channel_digits" CHECK ("announceChannelId" IS NULL OR "announceChannelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_channel_mode_has_channel" CHECK ("announce" <> 'channel' OR "announceChannelId" IS NOT NULL);
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_list_sizes" CHECK (cardinality("noXpChannelIds") <= 50 AND cardinality("noXpRoleIds") <= 50);
ALTER TABLE "LevelReward" ADD CONSTRAINT "LevelReward_level_range" CHECK ("level" BETWEEN 1 AND 500);
ALTER TABLE "LevelReward" ADD CONSTRAINT "LevelReward_role_digits" CHECK ("roleId" ~ '^[0-9]{17,20}$');
ALTER TABLE "MemberXp" ADD CONSTRAINT "MemberXp_user_digits" CHECK ("userId" ~ '^[0-9]{17,20}$');
ALTER TABLE "MemberXp" ADD CONSTRAINT "MemberXp_nonnegative" CHECK ("xp" >= 0 AND "messages" >= 0 AND "voiceMinutes" >= 0);
