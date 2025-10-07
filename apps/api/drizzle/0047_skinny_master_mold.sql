CREATE TABLE "stake_boost_awards" (
	"id" serial PRIMARY KEY NOT NULL,
	"stake_id" bigint NOT NULL,
	"boost_change_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stake_boost_awards" ADD CONSTRAINT "stake_boost_awards_stake_id_stakes_id_fk" FOREIGN KEY ("stake_id") REFERENCES "public"."stakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stake_boost_awards" ADD CONSTRAINT "stake_boost_awards_boost_change_id_boost_changes_id_fk" FOREIGN KEY ("boost_change_id") REFERENCES "public"."boost_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stake_boost_awards" ADD CONSTRAINT "stake_boost_awards_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stake_boost_awards_stake_id_competition_id_idx" ON "stake_boost_awards" USING btree ("stake_id","competition_id");