-- CreateEnum
CREATE TYPE "RolePanelStyle" AS ENUM ('buttons', 'menu');

-- CreateTable
CREATE TABLE "RolePanel" (
    "id" TEXT NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "messageId" VARCHAR(20),
    "title" VARCHAR(256) NOT NULL DEFAULT '',
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "color" INTEGER NOT NULL DEFAULT 65448,
    "style" "RolePanelStyle" NOT NULL DEFAULT 'buttons',
    "exclusive" BOOLEAN NOT NULL DEFAULT false,
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePanel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePanelRole" (
    "id" TEXT NOT NULL,
    "panelId" TEXT NOT NULL,
    "roleId" VARCHAR(20) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "emoji" VARCHAR(32) NOT NULL DEFAULT '',
    "description" VARCHAR(100) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RolePanelRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolePanel_createdAt_idx" ON "RolePanel"("createdAt");

-- CreateIndex
CREATE INDEX "RolePanelRole_panelId_position_idx" ON "RolePanelRole"("panelId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RolePanelRole_panelId_roleId_key" ON "RolePanelRole"("panelId", "roleId");

-- AddForeignKey
ALTER TABLE "RolePanelRole" ADD CONSTRAINT "RolePanelRole_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "RolePanel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "RolePanel" ADD CONSTRAINT "RolePanel_ids_digits"
  CHECK ("channelId" ~ '^[0-9]{17,20}$' AND ("messageId" IS NULL OR "messageId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "RolePanel" ADD CONSTRAINT "RolePanel_color_range" CHECK ("color" BETWEEN 0 AND 16777215);
ALTER TABLE "RolePanelRole" ADD CONSTRAINT "RolePanelRole_roleId_digits" CHECK ("roleId" ~ '^[0-9]{17,20}$');
