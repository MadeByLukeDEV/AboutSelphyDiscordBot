-- CreateTable
CREATE TABLE "CustomCommand" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "response" VARCHAR(1800) NOT NULL,
    "ephemeral" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomCommand_name_key" ON "CustomCommand"("name");

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "CustomCommand" ADD CONSTRAINT "CustomCommand_name_format" CHECK ("name" ~ '^[a-z0-9][a-z0-9_-]{0,31}$');
ALTER TABLE "CustomCommand" ADD CONSTRAINT "CustomCommand_response_not_empty" CHECK (length(btrim("response")) > 0);
ALTER TABLE "CustomCommand" ADD CONSTRAINT "CustomCommand_uses_positive" CHECK ("uses" >= 0);
