import { db } from "../index.js";
import {
  InsertCompetition,
  InsertCompetitionTeam,
  InsertTeam,
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
