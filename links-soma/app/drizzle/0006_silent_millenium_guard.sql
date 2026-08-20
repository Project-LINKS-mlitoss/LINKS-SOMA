CREATE TABLE `tutorial_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`phase` text NOT NULL,
	`stage` text,
	`draft_job_id` integer,
	`model_job_id` integer,
	`evaluation_job_id` integer,
	`resume_state` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`draft_job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evaluation_job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
