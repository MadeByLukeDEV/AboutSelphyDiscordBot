-- CreateTable
CREATE TABLE "ModGuide" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "channelId" VARCHAR(20),
    "title" VARCHAR(100) NOT NULL DEFAULT 'Moderator guide',
    "description" VARCHAR(1500) NOT NULL DEFAULT '',
    "imageUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "color" VARCHAR(7) NOT NULL DEFAULT '#00FFA8',
    "notes" VARCHAR(1500) NOT NULL DEFAULT '',
    "messageIds" TEXT[],
    "postedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModGuide_pkey" PRIMARY KEY ("id")
);

-- The guide is a singleton, its picture is https only and its colour a hex value.
ALTER TABLE "ModGuide" ADD CONSTRAINT "ModGuide_singleton" CHECK ("id" = 1);
ALTER TABLE "ModGuide" ADD CONSTRAINT "ModGuide_image_https" CHECK ("imageUrl" = '' OR "imageUrl" LIKE 'https://%');
ALTER TABLE "ModGuide" ADD CONSTRAINT "ModGuide_color_hex" CHECK ("color" ~ '^#[0-9a-fA-F]{6}$');
