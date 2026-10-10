-- CreateTable
CREATE TABLE "WelcomeConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "autoRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "botAutoRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restoreRoles" BOOLEAN NOT NULL DEFAULT false,
    "welcomeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "welcomeChannelId" VARCHAR(20),
    "welcomeTemplate" VARCHAR(1000) NOT NULL DEFAULT 'Welcome to {server}, {user}! You are member #{count}.',
    "welcomeAsEmbed" BOOLEAN NOT NULL DEFAULT true,
    "welcomeColor" INTEGER NOT NULL DEFAULT 65448,
    "welcomeImageUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "dmEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dmTemplate" VARCHAR(1000) NOT NULL DEFAULT 'Welcome to {server}! Have a look at the rules and say hi.',
    "goodbyeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "goodbyeChannelId" VARCHAR(20),
    "goodbyeTemplate" VARCHAR(1000) NOT NULL DEFAULT '{username} has left the server.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WelcomeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRoleSnapshot" (
    "userId" VARCHAR(20) NOT NULL,
    "roleIds" TEXT[],
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberRoleSnapshot_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "MemberRoleSnapshot_savedAt_idx" ON "MemberRoleSnapshot"("savedAt");


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_ids_digits"
  CHECK (("welcomeChannelId" IS NULL OR "welcomeChannelId" ~ '^[0-9]{17,20}$')
     AND ("goodbyeChannelId" IS NULL OR "goodbyeChannelId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_color_range" CHECK ("welcomeColor" BETWEEN 0 AND 16777215);
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_image_https" CHECK ("welcomeImageUrl" = '' OR "welcomeImageUrl" ~ '^https://');
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_role_lists"
  CHECK (cardinality("autoRoleIds") <= 5 AND cardinality("botAutoRoleIds") <= 5);
-- A message that is switched on needs somewhere to go.
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_welcome_has_channel" CHECK (NOT "welcomeEnabled" OR "welcomeChannelId" IS NOT NULL);
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_goodbye_has_channel" CHECK (NOT "goodbyeEnabled" OR "goodbyeChannelId" IS NOT NULL);
ALTER TABLE "MemberRoleSnapshot" ADD CONSTRAINT "MemberRoleSnapshot_userId_digits" CHECK ("userId" ~ '^[0-9]{17,20}$');
