CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`stock` integer NOT NULL,
	CONSTRAINT "stock_nonnegative" CHECK("products"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL
);
