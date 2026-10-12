-- CreateTable
CREATE TABLE "LevelBoost" (
    "id" TEXT NOT NULL,
    "roleId" VARCHAR(20) NOT NULL,
    "percent" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelBoost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LevelBoost_roleId_key" ON "LevelBoost"("roleId");

-- A boost makes XP bigger: more than 100 %, at most five times.
ALTER TABLE "LevelBoost" ADD CONSTRAINT "LevelBoost_percent_range" CHECK ("percent" BETWEEN 101 AND 500);
