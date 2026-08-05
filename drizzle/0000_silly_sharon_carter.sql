CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`organization_id` integer,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_guild_idx` ON `audit_logs` (`guild_id`);--> statement-breakpoint
CREATE INDEX `audit_org_idx` ON `audit_logs` (`organization_id`);--> statement-breakpoint
CREATE TABLE `classification_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`classification_id` integer NOT NULL,
	`key` text NOT NULL,
	`display_name` text NOT NULL,
	`discord_role_id` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`custom_icon_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`classification_id`) REFERENCES `classifications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classification_option_key_uq` ON `classification_options` (`classification_id`,`key`);--> statement-breakpoint
CREATE INDEX `classification_option_role_idx` ON `classification_options` (`discord_role_id`);--> statement-breakpoint
CREATE TABLE `classifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`key` text NOT NULL,
	`display_name` text NOT NULL,
	`base_role_key` text NOT NULL,
	`exclusive` integer DEFAULT true NOT NULL,
	`allow_unassigned` integer DEFAULT true NOT NULL,
	`unassigned_label` text DEFAULT '미지정' NOT NULL,
	`capacity_field_key` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classification_org_key_uq` ON `classifications` (`organization_id`,`key`);--> statement-breakpoint
CREATE INDEX `classification_org_idx` ON `classifications` (`organization_id`);--> statement-breakpoint
CREATE TABLE `custom_field_definitions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`scope` text NOT NULL,
	`type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`select_options` text,
	`default_value` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `field_org_key_uq` ON `custom_field_definitions` (`organization_id`,`key`);--> statement-breakpoint
CREATE INDEX `field_org_idx` ON `custom_field_definitions` (`organization_id`);--> statement-breakpoint
CREATE TABLE `custom_field_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`definition_id` integer NOT NULL,
	`organization_id` integer NOT NULL,
	`term_id` integer,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`definition_id`) REFERENCES `custom_field_definitions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `field_value_target_uq` ON `custom_field_values` (`definition_id`,`organization_id`,`term_id`);--> statement-breakpoint
CREATE INDEX `field_value_org_idx` ON `custom_field_values` (`organization_id`);--> statement-breakpoint
CREATE INDEX `field_value_term_idx` ON `custom_field_values` (`term_id`);--> statement-breakpoint
CREATE TABLE `guild_configs` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`time_zone` text DEFAULT 'Asia/Seoul' NOT NULL,
	`locale` text DEFAULT 'ko-KR' NOT NULL,
	`administrator_role_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guild_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`foreign_name` text,
	`pronunciation` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`guild_id`) REFERENCES `guild_configs`(`guild_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_guild_key_uq` ON `organizations` (`guild_id`,`key`);--> statement-breakpoint
CREATE INDEX `org_guild_idx` ON `organizations` (`guild_id`);--> statement-breakpoint
CREATE TABLE `publications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`template_id` integer NOT NULL,
	`name` text NOT NULL,
	`channel_id` text NOT NULL,
	`message_id` text,
	`auto_refresh` integer DEFAULT true NOT NULL,
	`broken` integer DEFAULT false NOT NULL,
	`last_rendered_at` integer,
	`last_render_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `publication_org_idx` ON `publications` (`organization_id`);--> statement-breakpoint
CREATE INDEX `publication_channel_message_idx` ON `publications` (`channel_id`,`message_id`);--> statement-breakpoint
CREATE TABLE `role_bindings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`key` text NOT NULL,
	`display_name` text NOT NULL,
	`discord_role_id` text NOT NULL,
	`kind` text NOT NULL,
	`cardinality` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `binding_org_key_uq` ON `role_bindings` (`organization_id`,`key`);--> statement-breakpoint
CREATE INDEX `binding_org_idx` ON `role_bindings` (`organization_id`);--> statement-breakpoint
CREATE INDEX `binding_role_idx` ON `role_bindings` (`discord_role_id`);--> statement-breakpoint
CREATE TABLE `setup_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`state` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_expiry_idx` ON `setup_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `session_owner_idx` ON `setup_sessions` (`guild_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`is_draft` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_org_name_uq` ON `templates` (`organization_id`,`name`);--> statement-breakpoint
CREATE INDEX `template_org_idx` ON `templates` (`organization_id`);--> statement-breakpoint
CREATE TABLE `terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`term_number` integer,
	`display_name` text NOT NULL,
	`start_at` integer NOT NULL,
	`scheduled_end_at` integer,
	`actual_end_at` integer,
	`status` text NOT NULL,
	`end_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `term_org_idx` ON `terms` (`organization_id`);--> statement-breakpoint
CREATE INDEX `term_active_end_idx` ON `terms` (`status`,`scheduled_end_at`);