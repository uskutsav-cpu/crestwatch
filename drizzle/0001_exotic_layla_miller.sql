CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`lid` text NOT NULL,
	`threshold_tenths` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`was_above` integer DEFAULT 0 NOT NULL,
	`test_requested` integer DEFAULT 0 NOT NULL,
	`last_sent_at` integer,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_expiry_index` ON `push_subscriptions` (`expires_at`);