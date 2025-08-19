-- Custom SQL migration for backfilling registered participants in competitions --
UPDATE competitions
SET registered_participants = (
  SELECT COUNT(DISTINCT ca_count.agent_id) 
  FROM competition_agents ca_count 
  WHERE ca_count.competition_id = competitions.id 
  AND ca_count.status = 'active'::competition_agent_status
)::int;