ALTER TABLE "trading_comps"."balances" ALTER COLUMN "amount" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_token_values" ALTER COLUMN "amount" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_token_values" ALTER COLUMN "price" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."prices" ALTER COLUMN "price" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ALTER COLUMN "from_amount" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ALTER COLUMN "to_amount" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ALTER COLUMN "price" SET DATA TYPE numeric;