-- CreateTable
CREATE TABLE "ProductWatch" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "url" VARCHAR(600) NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "pingRoleId" VARCHAR(20),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "snapshot" JSONB,
    "baselined" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatus" VARCHAR(24),
    "lastChangedAt" TIMESTAMP(3),
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductWatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductWatch" ADD CONSTRAINT "ProductWatch_channelId_valid" CHECK ("channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "ProductWatch" ADD CONSTRAINT "ProductWatch_pingRoleId_valid" CHECK ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$');
ALTER TABLE "ProductWatch" ADD CONSTRAINT "ProductWatch_url_https" CHECK ("url" ~ '^https://');
