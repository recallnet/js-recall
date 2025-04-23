-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  contact_person VARCHAR(100) NOT NULL,
  api_key VARCHAR(400) UNIQUE NOT NULL,
  wallet_address VARCHAR(42) UNIQUE,
  bucket_addresses TEXT[],
  metadata JSONB,
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
CREATE INDEX IF NOT EXISTS idx_teams_metadata_ref_name ON teams((metadata->'ref'->>'name'));

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

-- Balances table
CREATE TABLE IF NOT EXISTS balances (
  id SERIAL PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token_address VARCHAR(50) NOT NULL,
  amount DECIMAL(30, 15) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  specific_chain VARCHAR(20), -- New column to track specific chain (eth, polygon, base, etc.)
  UNIQUE(team_id, token_address)
);

-- Create balance indexes
CREATE INDEX IF NOT EXISTS idx_balances_team_id ON balances(team_id);
CREATE INDEX IF NOT EXISTS idx_balances_specific_chain ON balances(specific_chain);

-- Trades table
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  from_token VARCHAR(50) NOT NULL,
  to_token VARCHAR(50) NOT NULL,
  from_amount DECIMAL(30, 15) NOT NULL,
  to_amount DECIMAL(30, 15) NOT NULL,
  price DECIMAL(30, 15) NOT NULL,
  success BOOLEAN NOT NULL,
  error TEXT,
  reason TEXT NOT NULL, -- Reason for the trade
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  from_chain VARCHAR(10), -- General chain type for from_token (evm, svm)
  to_chain VARCHAR(10), -- General chain type for to_token (evm, svm)
  from_specific_chain VARCHAR(20), -- Specific chain for from_token (eth, polygon, base, etc.)
  to_specific_chain VARCHAR(20) -- Specific chain for to_token (eth, polygon, base, etc.)
);

-- Create trade indexes
CREATE INDEX IF NOT EXISTS idx_trades_team_id ON trades(team_id);
CREATE INDEX IF NOT EXISTS idx_trades_competition_id ON trades(competition_id);
CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_from_chain ON trades(from_chain);
CREATE INDEX IF NOT EXISTS idx_trades_to_chain ON trades(to_chain);
CREATE INDEX IF NOT EXISTS idx_trades_from_specific_chain ON trades(from_specific_chain);
CREATE INDEX IF NOT EXISTS idx_trades_to_specific_chain ON trades(to_specific_chain);

-- Prices table
CREATE TABLE IF NOT EXISTS prices (
  id SERIAL PRIMARY KEY,
  token VARCHAR(50) NOT NULL,
  price DECIMAL(30, 15) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  chain VARCHAR(10), -- General chain type (evm, svm)
  specific_chain VARCHAR(20) -- New column to track specific chain (eth, polygon, base, etc.)
);

-- Create price indexes
CREATE INDEX IF NOT EXISTS idx_prices_token ON prices(token);
CREATE INDEX IF NOT EXISTS idx_prices_timestamp ON prices(timestamp);
CREATE INDEX IF NOT EXISTS idx_prices_token_timestamp ON prices(token, timestamp);
CREATE INDEX IF NOT EXISTS idx_prices_chain ON prices(chain);
CREATE INDEX IF NOT EXISTS idx_prices_token_chain ON prices(token, chain);
CREATE INDEX IF NOT EXISTS idx_prices_specific_chain ON prices(specific_chain);
CREATE INDEX IF NOT EXISTS idx_prices_token_specific_chain ON prices(token, specific_chain);

-- Portfolio Snapshots table
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id SERIAL PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  total_value DECIMAL(30, 15) NOT NULL
);

-- Create portfolio snapshot indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_team_competition ON portfolio_snapshots(team_id, competition_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp ON portfolio_snapshots(timestamp);

-- Portfolio Token Values table (details for portfolio snapshots)
CREATE TABLE IF NOT EXISTS portfolio_token_values (
  id SERIAL PRIMARY KEY,
  portfolio_snapshot_id INTEGER NOT NULL REFERENCES portfolio_snapshots(id) ON DELETE CASCADE,
  token_address VARCHAR(50) NOT NULL,
  amount DECIMAL(30, 15) NOT NULL,
  value_usd DECIMAL(30, 15) NOT NULL,
  price DECIMAL(30, 15) NOT NULL,
  specific_chain VARCHAR(20) -- New column to track specific chain
);

-- Create portfolio token values indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_token_values_snapshot_id ON portfolio_token_values(portfolio_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_token_values_specific_chain ON portfolio_token_values(specific_chain);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_competitions_updated_at ON competitions;
CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_balances_updated_at ON balances;
CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON balances
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column(); 