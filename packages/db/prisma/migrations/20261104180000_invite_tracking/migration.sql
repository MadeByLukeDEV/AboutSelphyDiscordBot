-- CreateTable
CREATE TABLE "MemberInvite" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(20) NOT NULL,
    "userName" VARCHAR(100) NOT NULL,
    "inviterId" VARCHAR(20),
    "inviterName" VARCHAR(100),
    "code" VARCHAR(32),
    "source" VARCHAR(8) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "MemberInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberInvite_inviterId_idx" ON "MemberInvite"("inviterId");
CREATE INDEX "MemberInvite_userId_idx" ON "MemberInvite"("userId");
CREATE INDEX "MemberInvite_joinedAt_idx" ON "MemberInvite"("joinedAt");

-- Only the three kinds of source the bot knows.
ALTER TABLE "MemberInvite" ADD CONSTRAINT "MemberInvite_source_valid" CHECK ("source" IN ('invite', 'vanity', 'unknown'));
