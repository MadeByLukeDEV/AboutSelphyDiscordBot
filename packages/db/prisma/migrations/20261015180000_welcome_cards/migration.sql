-- Several welcome messages, and an optional generated welcome card.
--
-- Order matters: the generated script dropped the old single template first. Here the new
-- list column is added, the existing template is COPIED into it, and only then is the old
-- column removed. The whole file runs as one transaction, so it either all applies or none of it.

-- 1. New columns -------------------------------------------------------------------------
ALTER TABLE "WelcomeConfig"
  ADD COLUMN "welcomeTemplates" TEXT[] NOT NULL DEFAULT ARRAY['Welcome to {server}, {user}! You are member #{count}.']::TEXT[],
  ADD COLUMN "welcomeCardEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "welcomeCardMode" VARCHAR(12) NOT NULL DEFAULT 'background',
  ADD COLUMN "welcomeCardTitle" VARCHAR(40) NOT NULL DEFAULT 'Welcome',
  ADD COLUMN "welcomeCardSubtitle" VARCHAR(80) NOT NULL DEFAULT 'Member #{count}';

-- 2. Keep what was saved --------------------------------------------------------------------
UPDATE "WelcomeConfig" SET "welcomeTemplates" = ARRAY["welcomeTemplate"]::TEXT[];

-- 3. The old column is no longer needed -------------------------------------------------------
ALTER TABLE "WelcomeConfig" DROP COLUMN "welcomeTemplate";

-- 4. The image the admin uploads ----------------------------------------------------------------
CREATE TABLE "WelcomeCardImage" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" BYTEA NOT NULL,
    "contentType" VARCHAR(20) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "uploadedByName" VARCHAR(100) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WelcomeCardImage_pkey" PRIMARY KEY ("id")
);

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_templates_count" CHECK (cardinality("welcomeTemplates") <= 10);
-- A welcome message that is switched on needs at least one text to post.
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_welcome_has_text" CHECK (NOT "welcomeEnabled" OR cardinality("welcomeTemplates") >= 1);
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_card_mode" CHECK ("welcomeCardMode" IN ('background', 'sticker'));
ALTER TABLE "WelcomeCardImage" ADD CONSTRAINT "WelcomeCardImage_singleton" CHECK ("id" = 1);
ALTER TABLE "WelcomeCardImage" ADD CONSTRAINT "WelcomeCardImage_type" CHECK ("contentType" IN ('image/png', 'image/jpeg', 'image/webp'));
ALTER TABLE "WelcomeCardImage" ADD CONSTRAINT "WelcomeCardImage_size" CHECK (octet_length("data") BETWEEN 1 AND 3145728);
ALTER TABLE "WelcomeCardImage" ADD CONSTRAINT "WelcomeCardImage_dimensions" CHECK ("width" BETWEEN 64 AND 4096 AND "height" BETWEEN 64 AND 4096);
