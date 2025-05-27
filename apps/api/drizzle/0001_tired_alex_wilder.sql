CREATE TABLE "epochs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"epoch" uuid NOT NULL,
	"address" varchar(50) NOT NULL,
	"amount" numeric(30, 18) NOT NULL,
	"leaf_hash" "bytea" NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards_roots" (
	"id" serial PRIMARY KEY NOT NULL,
	"epoch" uuid NOT NULL,
	"root_hash" "bytea" NOT NULL,
	"tx" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rewards_tree" (
	"id" serial PRIMARY KEY NOT NULL,
	"epoch" uuid NOT NULL,
	"level" integer NOT NULL,
	"idx" integer NOT NULL,
	"hash" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stakes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(30, 18) NOT NULL,
	"address" varchar(50) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"withdrawal_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"epoch_created" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_assignments" (
	"stake_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"epoch" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" numeric(30, 18) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes_available" (
	"user_id" uuid NOT NULL,
	"epoch" uuid NOT NULL,
	"amount" numeric(30, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_available_pkey" PRIMARY KEY("user_id","epoch")
);
--> statement-breakpoint
CREATE TABLE "votes_performed" (
	"user_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"epoch" uuid NOT NULL,
	"amount" numeric(30, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_epoch_epochs_id_fk" FOREIGN KEY ("epoch") REFERENCES "public"."epochs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_roots" ADD CONSTRAINT "rewards_roots_epoch_epochs_id_fk" FOREIGN KEY ("epoch") REFERENCES "public"."epochs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards_tree" ADD CONSTRAINT "rewards_tree_epoch_epochs_id_fk" FOREIGN KEY ("epoch") REFERENCES "public"."epochs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakes" ADD CONSTRAINT "stakes_epoch_created_epochs_id_fk" FOREIGN KEY ("epoch_created") REFERENCES "public"."epochs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_assignments" ADD CONSTRAINT "vote_assignments_stake_id_stakes_id_fk" FOREIGN KEY ("stake_id") REFERENCES "public"."stakes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_assignments" ADD CONSTRAINT "vote_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_assignments" ADD CONSTRAINT "vote_assignments_epoch_epochs_id_fk" FOREIGN KEY ("epoch") REFERENCES "public"."epochs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes_available" ADD CONSTRAINT "votes_available_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes_available" ADD CONSTRAINT "votes_available_epoch_epochs_id_fk" FOREIGN KEY ("epoch") REFERENCES "public"."epochs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes_performed" ADD CONSTRAINT "votes_performed_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes_performed" ADD CONSTRAINT "votes_performed_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes_performed" ADD CONSTRAINT "votes_performed_epoch_epochs_id_fk" FOREIGN KEY ("epoch") REFERENCES "public"."epochs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rewards_epoch_id" ON "rewards" USING btree ("epoch");--> statement-breakpoint
CREATE INDEX "idx_rewards_roots_epoch_id" ON "rewards_roots" USING btree ("epoch");--> statement-breakpoint
CREATE INDEX "idx_rewards_tree_level_hash" ON "rewards_tree" USING btree ("level","hash");--> statement-breakpoint
CREATE INDEX "idx_rewards_tree_level_idx" ON "rewards_tree" USING btree ("level","idx");--> statement-breakpoint
CREATE INDEX "idx_vote_assignments_user_id" ON "vote_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_vote_assignments_epoch" ON "vote_assignments" USING btree ("epoch");--> statement-breakpoint
CREATE INDEX "idx_vote_assignments_stake_id" ON "vote_assignments" USING btree ("stake_id");--> statement-breakpoint
CREATE INDEX "idx_votes_available_user_id" ON "votes_available" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_votes_performed_user_id" ON "votes_performed" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_votes_performed_agent_id" ON "votes_performed" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_votes_performed_epoch" ON "votes_performed" USING btree ("epoch");