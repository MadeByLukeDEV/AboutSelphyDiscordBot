-- CreateTable
CREATE TABLE "ModuleFlag" (
    "key" VARCHAR(24) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedByName" VARCHAR(100) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleFlag_pkey" PRIMARY KEY ("key")
);

-- Hand-written CHECK constraint (Prisma can't express it).
ALTER TABLE "ModuleFlag" ADD CONSTRAINT "ModuleFlag_key_format" CHECK ("key" ~ '^[a-z]{2,24}$');
