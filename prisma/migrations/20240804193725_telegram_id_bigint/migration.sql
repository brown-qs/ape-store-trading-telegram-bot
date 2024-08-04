-- AlterTable
ALTER TABLE `setting` MODIFY `telegram_id` BIGINT NULL;

-- AlterTable
ALTER TABLE `task` MODIFY `telegram_id` BIGINT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `transferlog` MODIFY `telegram_id` BIGINT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `wallet` MODIFY `telegram_id` BIGINT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `watch` MODIFY `telegram_id` BIGINT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `watchlog` MODIFY `telegram_id` BIGINT NULL DEFAULT 0;
