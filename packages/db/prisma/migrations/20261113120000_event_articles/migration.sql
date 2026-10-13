-- CreateTable
CREATE TABLE "EventArticle" (
    "id" TEXT NOT NULL,
    "monthKey" VARCHAR(7) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "text" TEXT NOT NULL,
    "importedByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventArticle_createdAt_idx" ON "EventArticle"("createdAt");

ALTER TABLE "EventArticle" ADD CONSTRAINT "EventArticle_size" CHECK (length("text") <= 40000);
ALTER TABLE "EventArticle" ADD CONSTRAINT "EventArticle_month_format" CHECK ("monthKey" ~ '^[0-9]{4}-[0-9]{2}$');
