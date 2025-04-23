-- Drop all tables in the database
-- This script will drop all tables and functions, leaving you with a clean database

-- First disable foreign key checks temporarily
SET session_replication_role = 'replica';

-- Drop triggers first
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
DROP TRIGGER IF EXISTS update_competitions_updated_at ON competitions;
DROP TRIGGER IF EXISTS update_balances_updated_at ON balances;

-- Drop all tables in the correct order
DROP TABLE IF EXISTS portfolio_token_values CASCADE;
DROP TABLE IF EXISTS portfolio_snapshots CASCADE;
DROP TABLE IF EXISTS prices CASCADE;
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS balances CASCADE;
DROP TABLE IF EXISTS competition_teams CASCADE;
DROP TABLE IF EXISTS competitions CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Drop the update function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Re-enable foreign key checks
SET session_replication_role = 'origin'; 