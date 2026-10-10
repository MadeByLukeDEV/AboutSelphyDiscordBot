-- AlterTable
ALTER TABLE "RolePanel" ADD COLUMN     "imageUrl" VARCHAR(500) NOT NULL DEFAULT '';


-- Hand-written CHECK constraint (Prisma can't express it): only https pictures.
ALTER TABLE "RolePanel" ADD CONSTRAINT "RolePanel_image_https" CHECK ("imageUrl" = '' OR "imageUrl" ~ '^https://');
