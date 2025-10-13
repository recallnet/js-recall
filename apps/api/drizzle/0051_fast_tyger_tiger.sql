CREATE TABLE "sanctioned_wallets" (
	"address" varchar(42) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitions" DROP COLUMN "minimum_stake";--> statement-breakpoint
ALTER TABLE "stake_boost_awards" DROP COLUMN "base_amount";--> statement-breakpoint
ALTER TABLE "stake_boost_awards" DROP COLUMN "multiplier";