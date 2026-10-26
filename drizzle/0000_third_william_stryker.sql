CREATE TABLE `participant_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`step` integer NOT NULL,
	`condition` text NOT NULL,
	`task` text NOT NULL,
	`started_at` integer NOT NULL,
	`stopped_at` integer NOT NULL,
	`lookup_ms` integer NOT NULL,
	`outcome` text NOT NULL,
	`answer` text NOT NULL,
	`help` text NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `participant_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_attempt_once` ON `participant_attempts` (`session_id`,`step`);--> statement-breakpoint
CREATE TABLE `participant_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`condition_order` text NOT NULL,
	`created_at` integer NOT NULL,
	`study_version` text NOT NULL,
	`familiarity` text NOT NULL,
	`device` text NOT NULL,
	`next_index` integer DEFAULT 0 NOT NULL,
	`current_started_at` integer,
	`current_stopped_at` integer,
	`current_outcome` text,
	`finished_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_token_unique` ON `participant_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `participant_created_index` ON `participant_sessions` (`created_at`);