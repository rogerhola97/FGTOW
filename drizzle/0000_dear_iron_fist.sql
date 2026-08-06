CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`city` text NOT NULL,
	`product_type` text NOT NULL,
	`budget` text,
	`message` text NOT NULL,
	`consent` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'website' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL
);
