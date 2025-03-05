CREATE TABLE `job_results` (
	`id` integer PRIMARY KEY NOT NULL,
	`job_id` integer NOT NULL,
	`file_path` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `job_tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`job_id` integer NOT NULL,
	`progress_percent` text,
	`preprocess_type` text,
	`error_code` text,
	`result` blob,
	`finished_at` text DEFAULT (CURRENT_TIMESTAMP),
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`type` text,
	`parameters` blob NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_files` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_name` text,
	`note` text,
	`file_path` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
