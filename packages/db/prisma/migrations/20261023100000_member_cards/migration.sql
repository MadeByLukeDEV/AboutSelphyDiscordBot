-- AlterTable
ALTER TABLE "BirthdayConfig" ADD COLUMN     "cardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cardMode" VARCHAR(12) NOT NULL DEFAULT 'background',
ADD COLUMN     "cardSubtitle" VARCHAR(80) NOT NULL DEFAULT '{date}',
ADD COLUMN     "cardTitle" VARCHAR(40) NOT NULL DEFAULT 'Happy birthday';

-- AlterTable
ALTER TABLE "ReminderConfig" ADD COLUMN     "cardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cardMode" VARCHAR(12) NOT NULL DEFAULT 'background',
ADD COLUMN     "cardTitle" VARCHAR(40) NOT NULL DEFAULT 'Reminder';

-- CreateTable
CREATE TABLE "MemberCardImage" (
    "kind" VARCHAR(12) NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" VARCHAR(20) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "uploadedByName" VARCHAR(100) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberCardImage_pkey" PRIMARY KEY ("kind")
);

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "BirthdayConfig" ADD CONSTRAINT "BirthdayConfig_card_mode" CHECK ("cardMode" IN ('background', 'sticker'));
ALTER TABLE "ReminderConfig" ADD CONSTRAINT "ReminderConfig_card_mode" CHECK ("cardMode" IN ('background', 'sticker'));
ALTER TABLE "MemberCardImage" ADD CONSTRAINT "MemberCardImage_kind" CHECK ("kind" IN ('birthday', 'reminder'));
ALTER TABLE "MemberCardImage" ADD CONSTRAINT "MemberCardImage_type" CHECK ("contentType" IN ('image/png', 'image/jpeg', 'image/webp'));
ALTER TABLE "MemberCardImage" ADD CONSTRAINT "MemberCardImage_size" CHECK (length("data") BETWEEN 1 AND 3145728 AND "width" BETWEEN 64 AND 4096 AND "height" BETWEEN 64 AND 4096);
