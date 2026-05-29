ALTER TABLE `data_set_detail_buildings` ADD `has_usage_data` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `num_zero_periods` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `min_water_usage` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `usage_data_unavailable_flag` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `usage_first_half_avg` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `usage_second_half_avg` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `usage_half_year_change_rate` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `recent_usage_avg` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `max_age_juki_residence_isnull` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `has_cancellation_event` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `num_outmigrant_events` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `years_since_last_transfer` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `years_since_last_transfer_is_missing` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `sole_elderly_resident` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `death_no_replacement` integer;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `household_shrinkage_rate` real;--> statement-breakpoint
ALTER TABLE `data_set_detail_buildings` ADD `composite_rule_score` real;