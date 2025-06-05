ALTER TABLE "votes_available" DROP CONSTRAINT "votes_available_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "votes_available" ADD COLUMN "address" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "votes_available" DROP COLUMN "user_id";--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'votes_available_pkey'
          AND table_name = 'votes_available'
          AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE votes_available DROP CONSTRAINT votes_available_pkey;
    END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "votes_available" ADD CONSTRAINT "votes_available_pkey" PRIMARY KEY("address","epoch");
