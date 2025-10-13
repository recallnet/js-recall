ALTER TABLE "stake_boost_awards" ADD COLUMN "base_amount" numeric(78, 0) NOT NULL;--> statement-breakpoint
ALTER TABLE "stake_boost_awards" ADD COLUMN "multiplier" numeric(6, 4) NOT NULL;