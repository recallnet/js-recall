CREATE TABLE "trading_comps"."votes_available" (
	"address" varchar(50) PRIMARY KEY NOT NULL,
	"epoch" numeric,
	"amount" numeric(30, 15) NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trading_comps"."votes_performed" (
	"address" varchar(50) PRIMARY KEY NOT NULL,
	"amount" numeric(30, 15) NOT NULL,
	"epoch" numeric,
	"destination" varchar(50) NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_votes_available_address" ON "trading_comps"."votes_available" USING btree ("address");--> statement-breakpoint
CREATE INDEX "idx_votes_available_address_epoch" ON "trading_comps"."votes_available" USING btree ("address","epoch");--> statement-breakpoint
CREATE INDEX "idx_votes_available_epoch" ON "trading_comps"."votes_available" USING btree ("epoch");--> statement-breakpoint
CREATE INDEX "idx_votes_performed_address" ON "trading_comps"."votes_performed" USING btree ("address");--> statement-breakpoint
CREATE INDEX "idx_votes_performed_address_epoch" ON "trading_comps"."votes_performed" USING btree ("address","amount");--> statement-breakpoint
CREATE INDEX "idx_votes_performed_destination" ON "trading_comps"."votes_performed" USING btree ("destination");--> statement-breakpoint
CREATE INDEX "idx_votes_performed_destination_epoch" ON "trading_comps"."votes_performed" USING btree ("destination","epoch");--> statement-breakpoint
CREATE INDEX "idx_votes_performed_epoch" ON "trading_comps"."votes_performed" USING btree ("epoch");