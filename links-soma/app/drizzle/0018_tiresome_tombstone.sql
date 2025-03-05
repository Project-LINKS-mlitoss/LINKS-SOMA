PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_jobs` (
	`id` integer PRIMARY KEY NOT NULL,
	`status` text,
	`type` text,
	`process_id` integer,
	`is_named` integer NOT NULL,
	`parameters` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_jobs`("id", "status", "type", "process_id", "is_named", "parameters", "created_at", "updated_at") SELECT "id", "status", "type", "process_id", "is_named", "parameters", "created_at", "updated_at" FROM `jobs`;--> statement-breakpoint
DROP TABLE `jobs`;--> statement-breakpoint
ALTER TABLE `__new_jobs` RENAME TO `jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_normalized_data_sets` (
	`id` integer PRIMARY KEY NOT NULL,
	`file_name` text,
	`file_path` text NOT NULL,
	`job_results_id` integer,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`job_results_id`) REFERENCES `job_results`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_normalized_data_sets`("id", "file_name", "file_path", "job_results_id", "created_at", "updated_at") SELECT "id", "file_name", "file_path", "job_results_id", "created_at", "updated_at" FROM `normalized_data_sets`;--> statement-breakpoint
DROP TABLE `normalized_data_sets`;--> statement-breakpoint
ALTER TABLE `__new_normalized_data_sets` RENAME TO `normalized_data_sets`;