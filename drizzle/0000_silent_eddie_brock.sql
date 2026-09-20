CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_accounts_email` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`white_id` text NOT NULL,
	`black_id` text NOT NULL,
	`outcome` text NOT NULL,
	`base` integer NOT NULL,
	`increment` integer NOT NULL,
	`moves` integer NOT NULL,
	`reason` text NOT NULL,
	`white_remaining` integer NOT NULL,
	`black_remaining` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`white_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`black_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_games_owner_created_at` ON `games` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_players_owner_id` ON `players` (`owner_id`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expires_at` ON `rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);