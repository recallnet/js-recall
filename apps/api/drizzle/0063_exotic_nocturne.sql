CREATE TABLE "trading_comps"."paper_trading_config" (
	"competition_id" uuid PRIMARY KEY NOT NULL,
	"max_trade_percentage" integer DEFAULT 25 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."paper_trading_initial_balances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"competition_id" uuid NOT NULL,
	"specific_chain" varchar(20) NOT NULL,
	"token_symbol" varchar(20) NOT NULL,
	"token_address" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "paper_trading_initial_balances_unique" UNIQUE("competition_id","specific_chain","token_symbol")
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "boost_time_decay_rate" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "trading_comps"."paper_trading_config" ADD CONSTRAINT "paper_trading_config_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trading_comps"."paper_trading_initial_balances" ADD CONSTRAINT "paper_trading_initial_balances_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_paper_trading_config_competition_id" ON "trading_comps"."paper_trading_config" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_paper_trading_initial_balances_competition_id" ON "trading_comps"."paper_trading_initial_balances" USING btree ("competition_id");