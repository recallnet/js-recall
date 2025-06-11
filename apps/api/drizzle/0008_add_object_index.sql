CREATE TABLE "object_index" (
	"id" uuid PRIMARY KEY NOT NULL,
	"object_key" text NOT NULL,
	"bucket_name" varchar(255) NOT NULL,
	"competition_id" uuid,
	"agent_id" uuid,
	"data_type" varchar(100) NOT NULL,
	"size_bytes" bigint,
	"content_hash" varchar(255),
	"metadata" jsonb,
	"event_timestamp" timestamp with time zone,
	"object_last_modified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "object_index" ADD CONSTRAINT "object_index_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_index" ADD CONSTRAINT "object_index_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "object_index" ADD CONSTRAINT "object_index_object_key_key" UNIQUE("object_key");--> statement-breakpoint
CREATE INDEX "idx_object_index_competition_id" ON "object_index" USING btree ("competition_id");--> statement-breakpoint
CREATE INDEX "idx_object_index_agent_id" ON "object_index" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_object_index_data_type" ON "object_index" USING btree ("data_type");--> statement-breakpoint
CREATE INDEX "idx_object_index_object_last_modified_at" ON "object_index" USING btree ("object_last_modified_at");--> statement-breakpoint
CREATE INDEX "idx_object_index_competition_modified" ON "object_index" USING btree ("competition_id","object_last_modified_at");