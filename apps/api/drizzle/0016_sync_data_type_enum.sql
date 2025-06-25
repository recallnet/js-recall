-- Create sync_data_type enum
CREATE TYPE "sync_data_type" AS ENUM ('trade', 'agent_rank_history', 'agent_rank', 'competitions_leaderboard', 'portfolio_snapshot');

-- Alter object_index table to use the enum
ALTER TABLE "object_index" ALTER COLUMN "data_type" TYPE "sync_data_type" USING "data_type"::"sync_data_type";