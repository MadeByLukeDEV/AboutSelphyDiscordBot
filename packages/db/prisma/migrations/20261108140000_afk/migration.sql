-- CreateTable
CREATE TABLE "AfkStatus" (
    "userId" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(100) NOT NULL DEFAULT '',
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AfkStatus_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "AfkStatus" ADD CONSTRAINT "AfkStatus_userId_valid" CHECK ("userId" ~ '^[0-9]{17,20}$');
