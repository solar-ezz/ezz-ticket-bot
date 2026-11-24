-- AlterTable
ALTER TABLE "categories" ADD COLUMN "eventOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "guilds" ADD COLUMN "eventManagerRoles" TEXT NOT NULL DEFAULT '[]';
