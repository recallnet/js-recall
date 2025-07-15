CREATE TABLE "events_queue" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
