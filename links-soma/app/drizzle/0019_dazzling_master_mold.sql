PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_job_tasks` (
	`id` integer PRIMARY KEY NOT NULL,
	`job_id` integer NOT NULL,
	`progress_percent` text,
	`preprocess_type` text,
	`error_code` text,
	`result` text,
	`finished_at` text DEFAULT (CURRENT_TIMESTAMP),
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_job_tasks`("id", "job_id", "progress_percent", "preprocess_type", "error_code", "result", "finished_at", "created_at", "updated_at") SELECT "id", "job_id", "progress_percent", "preprocess_type", "error_code", "result", "finished_at", "created_at", "updated_at" FROM `job_tasks`;--> statement-breakpoint
DROP TABLE `job_tasks`;--> statement-breakpoint
ALTER TABLE `__new_job_tasks` RENAME TO `job_tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;