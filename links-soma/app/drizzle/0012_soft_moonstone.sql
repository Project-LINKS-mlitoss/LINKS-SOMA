CREATE TABLE `normalized_data_sets` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_name` text,
	`file_path` text NOT NULL,
	`job_results_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `raw_data_sets` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`job_results_id` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
