import { db } from "../index.js";
import {
  InsertBalance,
  InsertCompetition,
  InsertCompetitionTeam,
  InsertTeam,
  balances,
  competitionTeams,
  competitions,
  teams,
} from "../schema.js";

export async function createTeam(team: InsertTeam) {
  await db.insert(teams).values(team);
}

export async function createCompetition(competition: InsertCompetition) {
  await db.insert(competitions).values(competition);
}

export async function registerTeamToCompetition(
  competitionTeam: InsertCompetitionTeam,
) {
  await db.insert(competitionTeams).values(competitionTeam);
}

export async function createBalance(balance: InsertBalance) {
  return await db
    .insert(balances)
    .values(balance)
    .onConflictDoUpdate({
      target: [balances.teamId, balances.tokenAddress],
      set: { amount: balance.amount, updatedAt: new Date() },
    });
}
