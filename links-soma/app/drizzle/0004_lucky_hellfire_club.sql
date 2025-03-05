CREATE TABLE `data_sets_results` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
