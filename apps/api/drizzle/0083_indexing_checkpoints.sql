CREATE TABLE "indexing_checkpoints" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"next_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
