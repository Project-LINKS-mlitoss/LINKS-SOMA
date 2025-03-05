ALTER TABLE `data_set_detail_areas` ADD `area_group` text;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `area_group` text;--> statement-breakpoint
ALTER TABLE `data_set_detail_areas` DROP COLUMN `address`;
