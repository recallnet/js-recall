ALTER TABLE "trading_comps"."balances" ADD COLUMN "symbol" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_comps"."portfolio_token_values" ADD COLUMN "symbol" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_comps"."prices" ADD COLUMN "symbol" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_comps"."trades" ADD COLUMN "to_token_symbol" varchar(20) NOT NULL;