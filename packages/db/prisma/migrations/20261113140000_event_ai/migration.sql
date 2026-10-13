-- AlterTable
ALTER TABLE "EventRule" ADD COLUMN "useAi" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EventSummary" (
    "hash" VARCHAR(40) NOT NULL,
    "json" VARCHAR(4000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSummary_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "EventSummary_createdAt_idx" ON "EventSummary"("createdAt");
