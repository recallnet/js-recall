CREATE TABLE "trading_comps"."competition_configurations" (
	"competition_id" uuid PRIMARY KEY NOT NULL,
	"portfolio_price_freshness_ms" integer DEFAULT 600000 NOT NULL,
	"portfolio_snapshot_cron" varchar(50) DEFAULT '*/5 * * * *' NOT NULL,
	"max_trade_percentage" integer DEFAULT 25 NOT NULL,
	"price_cache_duration_ms" integer DEFAULT 30000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."competition_initial_balances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"specific_chain" varchar(20) NOT NULL,
	"token_symbol" varchar(20) NOT NULL,
	"token_address" varchar(50) NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "competition_initial_balances_unique" UNIQUE("competition_id","specific_chain","token_symbol")
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."competition_configurations" ADD CONSTRAINT "competition_configurations_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."competition_initial_balances" ADD CONSTRAINT "competition_initial_balances_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_competition_configurations_competition_id" ON "trading_comps"."competition_configurations" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_competition_initial_balances_competition_id" ON "trading_comps"."competition_initial_balances" USING btree ("competition_id");