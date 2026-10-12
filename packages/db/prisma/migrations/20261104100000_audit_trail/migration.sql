-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" VARCHAR(64) NOT NULL,
    "actorName" VARCHAR(100) NOT NULL,
    "actorRole" VARCHAR(16) NOT NULL,
    "area" VARCHAR(40) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "target" VARCHAR(64) NOT NULL DEFAULT '',

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEntry_at_idx" ON "AuditEntry"("at");
CREATE INDEX "AuditEntry_area_at_idx" ON "AuditEntry"("area", "at");
