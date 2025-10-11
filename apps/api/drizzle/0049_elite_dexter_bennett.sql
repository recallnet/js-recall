CREATE TABLE "sanctioned_wallets" (
	"address" varchar(42) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_sanctioned_wallets_address" ON "sanctioned_wallets" USING btree ("address");