CREATE TABLE "trading_comps"."trading_constraints" (
	"competition_id" uuid PRIMARY KEY NOT NULL,
	"minimum_pair_age_hours" integer NOT NULL,
	"minimum_24h_volume_usd" numeric(20, 2) NOT NULL,
	"minimum_liquidity_usd" numeric(20, 2) NOT NULL,
	"minimum_fdv_usd" numeric(20, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "trading_comps"."trading_constraints" ADD CONSTRAINT "trading_constraints_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_trading_constraints_competition_id" ON "trading_comps"."trading_constraints" USING btree ("competition_id");