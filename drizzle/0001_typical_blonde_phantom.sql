DROP INDEX `field_value_target_uq`;--> statement-breakpoint
CREATE UNIQUE INDEX `field_value_org_target_uq` ON `custom_field_values` (`definition_id`,`organization_id`) WHERE "custom_field_values"."term_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `field_value_term_target_uq` ON `custom_field_values` (`definition_id`,`term_id`) WHERE "custom_field_values"."term_id" is not null;--> statement-breakpoint
ALTER TABLE `organizations` ADD `deleted_at` integer;