CREATE TABLE `forum_publication_settings` (
	`publication_id` integer PRIMARY KEY NOT NULL,
	`title_template` text NOT NULL,
	`applied_tag_ids_json` text DEFAULT '[]' NOT NULL,
	`auto_archive_duration` integer DEFAULT 1440 NOT NULL,
	`slowmode_seconds` integer DEFAULT 0 NOT NULL,
	`archive_after_publish` integer DEFAULT false NOT NULL,
	`lock_after_publish` integer DEFAULT false NOT NULL,
	`preserve_manual_tags` integer DEFAULT false NOT NULL,
	`thread_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `publications`(`id`) ON UPDATE no action ON DELETE cascade
);
