ALTER TABLE `data_set_detail_buildings` ADD `building_age_years` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `years_since_inheritance` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `years_since_extension` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` DROP COLUMN `days_since_registration_event`;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` DROP COLUMN `flag_inheritance`;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` DROP COLUMN `flag_gift`;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` DROP COLUMN `flag_sale`;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` DROP COLUMN `flag_seizure`;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` DROP COLUMN `date_registration_event`;