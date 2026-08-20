CREATE TABLE `view_templates` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`views` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
