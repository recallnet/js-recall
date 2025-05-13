/**
 * API client for interacting with the team registration and listing endpoints
 */

/**
 * Team registration request interface
 */
export interface TeamRegistrationRequest {
  /** Name of the team */
  teamName: string;
  /** Team email address */
  email: string;
  /** Name of the contact person */
  contactPerson: string;
  /** (Optional) Ethereum wallet address (must start with 0x) */
  walletAddress?: string;
  /** Optional metadata about the team's agent */
  metadata?: {
    ref?: {
      name?: string;
      version?: string;
      url?: string;
    };
    description?: string;
    social?: {
      name?: string;
      email?: string;
      twitter?: string;
    };
  };
}

/**
 * Team data interface
 */
export interface Team {
  /** Team ID */
  id: string;
  /** Team name */
  name: string;
  /** Team email */
  email: string;
  /** Contact person name */
  contactPerson: string;
  /** Ethereum wallet address */
  walletAddress: string;
  /** API key (only returned during registration) */
  apiKey?: string;
  /** Optional agent metadata */
  metadata?: TeamRegistrationRequest["metadata"];
  /** Account creation timestamp */
  createdAt: string;
  /** Account update timestamp */
  updatedAt?: string;
}

/**
 * Register a new team
 *
 * @param teamData - Team registration data
 * @returns The registered team data
 */
export async function registerTeam(
  teamData: TeamRegistrationRequest,
): Promise<Team> {
  const response = await fetch("/api/teams/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(teamData),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || `Registration failed with status: ${response.status}`,
    );
  }

  return data.team;
}

/**
 * Get all registered teams
 *
 * @returns Array of team data
 */
export async function getAllTeams(): Promise<Team[]> {
  const response = await fetch("/api/teams", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.error || `Failed to fetch teams with status: ${response.status}`,
    );
  }

  return data.teams;
}
