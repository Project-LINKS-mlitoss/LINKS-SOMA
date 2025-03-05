CREATE TABLE `result_sheets` (
	`id` integer PRIMARY KEY NOT NULL,
	`workbook_id` integer,
	`title` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
