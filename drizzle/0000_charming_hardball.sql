CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_name_unique` ON `categories` (lower(`name`));--> statement-breakpoint
CREATE INDEX `idx_categories_sort_order` ON `categories` (`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `list_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_entries_category_name_unique` ON `list_entries` (`category_id`,lower(`name`));--> statement-breakpoint
CREATE INDEX `idx_entries_category_sort` ON `list_entries` (`category_id`,`sort_order`,`id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`media_url` text,
	`media_pathname` text,
	`media_type` text,
	`published_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "posts_media_type_check" CHECK("posts"."media_type" IN ('image', 'video') OR "posts"."media_type" IS NULL)
);
--> statement-breakpoint
CREATE INDEX `idx_posts_published_at` ON `posts` (`published_at`);