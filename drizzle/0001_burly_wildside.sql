CREATE TABLE `inventory` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`size` text NOT NULL,
	`color` text NOT NULL,
	`stock` integer NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "variant_stock_nonnegative" CHECK("inventory"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL,
	`order_id` text,
	FOREIGN KEY (`variant_id`) REFERENCES `inventory`(`id`) ON UPDATE no action ON DELETE no action
);
