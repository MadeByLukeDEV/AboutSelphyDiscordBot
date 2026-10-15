-- AlterTable
ALTER TABLE "EventRule" ADD COLUMN "useCard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventSource" ADD COLUMN "accentColor" VARCHAR(7) NOT NULL DEFAULT '#00ffa8';
ALTER TABLE "EventSource" ADD COLUMN "summaryImage" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventSource" ADD CONSTRAINT "EventSource_accent_valid" CHECK ("accentColor" ~ '^#[0-9a-fA-F]{6}$');

-- CreateTable
CREATE TABLE "EventItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "imageData" BYTEA,
    "imageType" VARCHAR(20),
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "imageUpdatedAt" TIMESTAMP(3),
    "uploadedByName" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSourceImage" (
    "sourceId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" VARCHAR(20) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "uploadedByName" VARCHAR(100) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSourceImage_pkey" PRIMARY KEY ("sourceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventItem_sourceId_key_key" ON "EventItem"("sourceId", "key");

-- AddForeignKey
ALTER TABLE "EventItem" ADD CONSTRAINT "EventItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventSourceImage" ADD CONSTRAINT "EventSourceImage_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventItem" ADD CONSTRAINT "EventItem_name_nonempty" CHECK (length(btrim("name")) > 0 AND length(btrim("key")) > 0);
ALTER TABLE "EventItem" ADD CONSTRAINT "EventItem_image_all_or_none" CHECK (("imageData" IS NULL) = ("imageType" IS NULL) AND ("imageData" IS NULL) = ("imageWidth" IS NULL) AND ("imageData" IS NULL) = ("imageHeight" IS NULL));
ALTER TABLE "EventItem" ADD CONSTRAINT "EventItem_image_size" CHECK ("imageData" IS NULL OR length("imageData") <= 3145728);
ALTER TABLE "EventSourceImage" ADD CONSTRAINT "EventSourceImage_size" CHECK (length("data") <= 3145728);
