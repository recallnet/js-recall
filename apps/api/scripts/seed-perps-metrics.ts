import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import { v4 as uuidv4 } from "uuid";

import {
  competitionAgents,
  competitions,
} from "@recallnet/db/schema/core/defs";
import { riskMetricsSnapshots } from "@recallnet/db/schema/trading/defs";

const { Pool } = pkg;

const DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/trading_simulator";

/**
 * Script to seed perps risk metrics with random but realistic data
 */
async function seedPerpsMetrics() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, {
    schema: { competitions, competitionAgents, riskMetricsSnapshots },
  });

  try {
    console.log("Starting perps metrics seeding...");

    // Find all perpetual_futures competitions
    const perpsCompetitions = await db
      .select()
      .from(competitions)
      .where(eq(competitions.type, "perpetual_futures"));

    console.log(`Found ${perpsCompetitions.length} perps competitions`);

    for (const competition of perpsCompetitions) {
      console.log(`\nProcessing competition: ${competition.name}`);

      // Find all agents in this competition
      const agents = await db
        .select()
        .from(competitionAgents)
        .where(eq(competitionAgents.competitionId, competition.id));

      console.log(`  Found ${agents.length} agents`);

      // Generate metrics for each agent based on their portfolio snapshots
      for (const agent of agents) {
        // Get portfolio snapshots for this agent to align risk metrics
        const portfolioSnapshots = await pool.query(
          `SELECT timestamp FROM trading_comps.portfolio_snapshots 
           WHERE agent_id = $1 AND competition_id = $2 
           ORDER BY timestamp ASC`,
          [agent.agentId, competition.id],
        );

        if (portfolioSnapshots.rows.length === 0) {
          console.log(
            `    No portfolio snapshots found for agent ${agent.agentId}, skipping`,
          );
          continue;
        }

        // Generate base performance (some agents win, some lose)
        const baseReturn = (Math.random() - 0.5) * 2; // -1 to +1
        const volatility = Math.random() * 0.3 + 0.1; // 0.1 to 0.4
        const totalSnapshots = portfolioSnapshots.rows.length;

        // Create risk metrics for ALL snapshots to ensure continuous chart lines
        for (let i = 0; i < portfolioSnapshots.rows.length; i++) {
          const snapshotRow = portfolioSnapshots.rows[i];
          const timestamp = new Date(snapshotRow.timestamp);

          // Progress through the competition
          const progressMultiplier = (i + 1) / totalSnapshots;
          const noise = (Math.random() - 0.5) * 0.2;

          const simpleReturn = baseReturn * progressMultiplier + noise;
          const annualizedReturn = simpleReturn * (365 / 7);

          // Max drawdown is negative and increases over time
          const maxDrawdown = Math.min(
            0,
            simpleReturn - Math.abs(volatility * progressMultiplier),
          );

          // Downside deviation
          const downsideDeviation = volatility * (0.5 + Math.random() * 0.5);

          // Calmar ratio = annualized return / abs(max drawdown)
          const calmarRatio =
            Math.abs(maxDrawdown) > 0.001
              ? annualizedReturn / Math.abs(maxDrawdown)
              : annualizedReturn * 10;

          // Sortino ratio = annualized return / downside deviation
          const sortinoRatio =
            downsideDeviation > 0.001
              ? annualizedReturn / downsideDeviation
              : annualizedReturn * 5;

          // Insert the snapshot with same timestamp as portfolio snapshot
          await db
            .insert(riskMetricsSnapshots)
            .values({
              id: uuidv4(),
              agentId: agent.agentId,
              competitionId: competition.id,
              timestamp,
              calmarRatio: calmarRatio.toString(),
              sortinoRatio: sortinoRatio.toString(),
              simpleReturn: simpleReturn.toString(),
              annualizedReturn: annualizedReturn.toString(),
              maxDrawdown: maxDrawdown.toString(),
              downsideDeviation: downsideDeviation.toString(),
            })
            .onConflictDoNothing();
        }

        console.log(
          `    Generated ${totalSnapshots} risk metrics for agent ${agent.agentId}`,
        );
      }
    }

    console.log("\nSeeding completed successfully!");
  } catch (error) {
    console.error("Error seeding perps metrics:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
seedPerpsMetrics().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
