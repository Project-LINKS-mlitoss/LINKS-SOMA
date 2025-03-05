ALTER TABLE `data_set_detail_areas` ADD `vacant_house_count` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_areas` ADD `predicted_probability` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_areas` DROP COLUMN `vacant_house_ratio`;
