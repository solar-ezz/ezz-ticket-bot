-- AlterTable
ALTER TABLE "categories" ADD COLUMN "eventOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "guilds" ADD COLUMN "eventManagerRoles" JSONB NOT NULL DEFAULT '[]';
