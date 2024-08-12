/*
  Warnings:

  - The `create_time` column on the `watchlog` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE `setting` ADD COLUMN `classic_mode` VARCHAR(20) NULL DEFAULT 'quick',
    ADD COLUMN `quick_buy_amount` DECIMAL(10, 5) NULL DEFAULT 0.00000,
    ADD COLUMN `trading_mode` VARCHAR(20) NULL DEFAULT 'classic';

-- AlterTable
ALTER TABLE `watchlog` DROP COLUMN `create_time`,
    ADD COLUMN `create_time` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `whitelist` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `telegram_id` BIGINT NULL DEFAULT 0,
    `telegram_name` VARCHAR(255) NOT NULL,
    `create_time` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
