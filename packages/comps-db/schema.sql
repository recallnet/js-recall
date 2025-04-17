-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  contact_person VARCHAR(100) NOT NULL,
  api_key VARCHAR(400) UNIQUE NOT NULL,
  wallet_address VARCHAR(42) UNIQUE,
  bucket_addresses TEXT[],
  is_admin BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT FALSE,
  deactivation_reason TEXT,
  deactivation_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create team indexes
CREATE INDEX IF NOT EXISTS idx_teams_api_key ON teams(api_key);
CREATE INDEX IF NOT EXISTS idx_teams_is_admin ON teams(is_admin);
CREATE INDEX IF NOT EXISTS idx_teams_active ON teams(active);

-- Competitions table
CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL, -- PENDING, ACTIVE, COMPLETED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create competition indexes
CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);

-- Competition Teams (junction table)
CREATE TABLE IF NOT EXISTS competition_teams (
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (competition_id, team_id)
);