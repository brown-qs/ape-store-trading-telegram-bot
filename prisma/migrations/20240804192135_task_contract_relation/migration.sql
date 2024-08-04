-- CreateTable
CREATE TABLE `analyzedata` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chain_id` INTEGER NULL DEFAULT 0,
    `address` VARCHAR(42) NULL,
    `holders` INTEGER NULL DEFAULT 0,
    `top_holder` TEXT NULL,
    `count` INTEGER NULL DEFAULT 0,
    `price` VARCHAR(255) NULL,
    `buy_list` TEXT NULL,
    `sell_list` TEXT NULL,
    `buy_amount` DECIMAL(10, 5) NULL,
    `sell_amount` DECIMAL(10, 5) NULL,
    `smart_money` INTEGER NULL DEFAULT 0,
    `inflow` DECIMAL(10, 5) NULL,
    `create_time` INTEGER NULL DEFAULT 0,

    INDEX `address`(`address`),
    INDEX `createTime`(`create_time`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contract` (
    `address` VARCHAR(42) NOT NULL,
    `chain_id` INTEGER NULL DEFAULT 0,
    `block_number` INTEGER NULL DEFAULT 0,
    `name` VARCHAR(255) NULL,
    `symbol` VARCHAR(255) NULL,
    `total_supply` VARCHAR(255) NULL,
    `decimals` INTEGER NULL DEFAULT 0,
    `owner` VARCHAR(42) NULL,
    `is_add_liquidity` TINYINT NULL DEFAULT 0,
    `is_remove_liquidity` TINYINT NULL DEFAULT 0,
    `is_check_price` TINYINT NULL DEFAULT 0,
    `pools` TEXT NULL,
    `liquidity_pools` TEXT NULL,
    `reserve0` VARCHAR(255) NULL,
    `first_price` VARCHAR(255) NULL,
    `first_pool_balance` VARCHAR(255) NULL,
    `liquidity_total` VARCHAR(255) NULL,
    `is_get_swap_fee` TINYINT NULL DEFAULT 0,
    `buy_fee` INTEGER NULL DEFAULT 0,
    `sell_fee` INTEGER NULL DEFAULT 0,
    `creator` VARCHAR(42) NULL,
    `update_time` INTEGER NULL DEFAULT 0,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`address`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hash` VARCHAR(66) NULL,
    `chain_id` INTEGER NULL DEFAULT 0,
    `from_address` VARCHAR(42) NULL,
    `to_address` VARCHAR(42) NULL,
    `in_target` VARCHAR(42) NULL,
    `in_amount` VARCHAR(255) NULL,
    `in_swap_fee` INTEGER NULL DEFAULT 0,
    `swap_out_address` VARCHAR(42) NULL,
    `out_target` VARCHAR(42) NULL,
    `out_amount` VARCHAR(255) NULL,
    `out_swap_fee` INTEGER NULL DEFAULT 0,
    `swap_in_address` VARCHAR(42) NULL,
    `swap_routers` TEXT NULL,
    `effective_gas_price` VARCHAR(255) NULL,
    `gas_used` VARCHAR(255) NULL,
    `block_number` INTEGER NULL DEFAULT 0,
    `create_time` INTEGER NULL DEFAULT 0,

    INDEX `swapInAddress`(`swap_in_address`),
    INDEX `swapOutAddress`(`swap_out_address`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `setting` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `telegram_id` INTEGER NULL,
    `chain_id` INTEGER NULL DEFAULT 0,
    `manual_gas_fee` INTEGER NULL DEFAULT 0,
    `follow_gas_fee` INTEGER NULL DEFAULT 0,
    `rush_gas_fee` INTEGER NULL DEFAULT 0,
    `rush_time` INTEGER NULL DEFAULT 0,
    `sell_percent` INTEGER NULL DEFAULT 0,
    `follow_swap_fee` INTEGER NULL DEFAULT 0,
    `manual_swap_fee` INTEGER NULL DEFAULT 0,
    `reaction_id` INTEGER NULL DEFAULT 0,
    `reaction_method` VARCHAR(20) NULL,
    `default_address` VARCHAR(42) NULL,
    `default_private_key` VARCHAR(66) NULL,
    `set_type` TINYINT NULL DEFAULT 0,
    `log_id` INTEGER NULL DEFAULT 0,
    `amount` DECIMAL(10, 5) NULL DEFAULT 0.00000,
    `follow_amount` DECIMAL(10, 5) NULL DEFAULT 0.00000,
    `query` TEXT NULL,
    `rush_amount` DECIMAL(10, 5) NULL DEFAULT 0.00000,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `smartmoney` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chain_id` INTEGER NULL DEFAULT 0,
    `address` VARCHAR(42) NULL,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `smartmoneyaddress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chain_id` INTEGER NULL DEFAULT 0,
    `address` VARCHAR(42) NULL,
    `count` INTEGER NULL DEFAULT 0,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chain_id` INTEGER NULL DEFAULT 0,
    `address` VARCHAR(42) NULL,
    `private_key` VARCHAR(66) NULL,
    `target` VARCHAR(42) NULL,
    `telegram_id` INTEGER NULL DEFAULT 0,
    `telegram_name` VARCHAR(255) NULL,
    `amount` VARCHAR(255) NULL,
    `percent` INTEGER NULL DEFAULT 0,
    `pool_percent` INTEGER NULL DEFAULT 0,
    `type` TINYINT NULL DEFAULT 0,
    `encode_data` TEXT NULL,
    `send_gas_fee` INTEGER NULL DEFAULT 0,
    `swap_fee` INTEGER NULL DEFAULT 0,
    `gas_fee` INTEGER NULL DEFAULT 0,
    `status` TINYINT NULL DEFAULT 0,
    `start_time` INTEGER NULL DEFAULT 0,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transferlog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hash` VARCHAR(66) NULL,
    `chain_id` INTEGER NULL DEFAULT 0,
    `address` VARCHAR(42) NULL,
    `target` VARCHAR(42) NULL,
    `in_target` VARCHAR(42) NULL,
    `in_amount` VARCHAR(255) NULL,
    `out_target` VARCHAR(42) NULL,
    `out_amount` VARCHAR(255) NULL,
    `telegram_id` INTEGER NULL DEFAULT 0,
    `telegram_name` VARCHAR(255) NULL,
    `price` VARCHAR(255) NULL,
    `type` TINYINT NULL DEFAULT 0,
    `status` TINYINT NULL DEFAULT 0,
    `transfer_type` TINYINT NULL DEFAULT 0,
    `is_sell` TINYINT NULL DEFAULT 0,
    `symbol` VARCHAR(255) NULL,
    `cost` VARCHAR(255) NULL DEFAULT '0.00000',
    `remark` TEXT NULL,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `address` VARCHAR(42) NULL,
    `private_key` VARCHAR(66) NULL,
    `telegram_id` INTEGER NULL DEFAULT 0,
    `telegram_name` VARCHAR(255) NULL,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `watch` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `address` VARCHAR(42) NULL,
    `name` VARCHAR(255) NULL,
    `telegram_id` INTEGER NULL DEFAULT 0,
    `telegram_name` VARCHAR(255) NULL,
    `follow_buy` TINYINT NULL DEFAULT 0,
    `follow_sell` TINYINT NULL DEFAULT 0,
    `follow_amount` DECIMAL(10, 5) NULL,
    `follow_gas_fee` INTEGER NULL DEFAULT 0,
    `follow_swap_fee` INTEGER NULL DEFAULT 0,
    `follow_private_key` VARCHAR(66) NULL,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `watchlog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hash` VARCHAR(66) NULL,
    `chain_id` INTEGER NULL DEFAULT 0,
    `address` VARCHAR(42) NULL,
    `name` VARCHAR(255) NULL,
    `in_target` VARCHAR(42) NULL,
    `in_all_reserve` VARCHAR(255) NULL,
    `in_price` VARCHAR(255) NULL,
    `in_name` VARCHAR(255) NULL,
    `in_pool` VARCHAR(42) NULL,
    `in_decimals` INTEGER NULL DEFAULT 0,
    `in_version` VARCHAR(20) NULL,
    `in_symbol` VARCHAR(255) NULL,
    `out_target` VARCHAR(42) NULL,
    `out_all_reserve` VARCHAR(255) NULL,
    `out_price` VARCHAR(255) NULL,
    `out_name` VARCHAR(255) NULL,
    `out_pool` VARCHAR(42) NULL,
    `out_decimals` INTEGER NULL DEFAULT 0,
    `out_version` VARCHAR(20) NULL,
    `out_symbol` VARCHAR(255) NULL,
    `telegram_id` INTEGER NULL DEFAULT 0,
    `telegram_name` VARCHAR(255) NULL,
    `price` VARCHAR(255) NULL,
    `amount_in` VARCHAR(255) NULL,
    `amount_out` VARCHAR(255) NULL,
    `swap_fee` INTEGER NULL DEFAULT 0,
    `left_amount` VARCHAR(255) NULL,
    `cost` VARCHAR(255) NULL,
    `type` TINYINT NULL DEFAULT 0,
    `create_time` INTEGER NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `task` ADD CONSTRAINT `task_target_fkey` FOREIGN KEY (`target`) REFERENCES `contract`(`address`) ON DELETE SET NULL ON UPDATE CASCADE;
