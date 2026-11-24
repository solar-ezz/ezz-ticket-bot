-- AlterTable
ALTER TABLE `categories` ADD COLUMN `eventOnly` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `guilds` ADD COLUMN `eventManagerRoles` JSON NULL;
UPDATE `guilds` SET `eventManagerRoles` = JSON_ARRAY() WHERE `eventManagerRoles` IS NULL;
ALTER TABLE `guilds` MODIFY `eventManagerRoles` JSON NOT NULL;
