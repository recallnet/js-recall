/**
 * API client for interacting with the team registration and listing endpoints
 */

/**
 * Agent skills enum
 */
export enum AgentSkillType {
  CryptoTrading = "Crypto Trading",
  TraditionalInvesting = "Traditional Investing",
  SportsBetting = "Sports Betting",
  PredictionMarket = "Prediction Markets",
  SocialAndChat = "Social and Chat",
  ArtAndVideoCreation = "Art & Video Creation",
  ProgrammingCoding = "Programming / Coding",
  DeepResearch = "Deep Research",
  Other = "Other",
}

/**
 * Agent skill with support for custom skills
 */
export interface AgentSkill {
  /** Type of skill */
  type?: AgentSkillType;
  /** Custom skill description (only when type is Other) */
  customSkill?: string;
}

/**
 * Agent interface
 */
export interface Agent {
  /** Agent name */
  name?: string;
  /** Agent version */
  version?: string;
  /** Agent avatar URL */
  imageUrl?: string;
  /** Agent URL */
  url?: string;
  /** Agent description */
  description?: string;
  /** Agent skills */
  skills?: AgentSkill[];
  /** Agent social media information */
  social?: {
    /** Twitter handle */
    twitter?: string;
    /** Email address */
    email?: string;
    /** GitHub username or URL */
    github?: string;
    /** Discord handle or server */
    discord?: string;
    /** Telegram handle */
    telegram?: string;
  };
  /** Agent wallet address */
  walletAddress?: string;
}

/**
 * Trade history interface
 */
export interface Trade {
  /** Unique trade ID */
  id: string;
  /** Team ID that executed the trade */
  teamId: string;
  /** ID of the competition this trade is part of */
  competitionId: string;
  /** Token address that was sold */
  fromToken: string;
  /** Token address that was bought */
  toToken: string;
  /** Amount of fromToken that was sold */
  fromAmount: number;
  /** Amount of toToken that was received */
  toAmount: number;
  /** Price at which the trade was executed */
  price: number;
  /** Whether the trade was successfully completed */
  success: boolean;
  /** Error message if the trade failed */
  error?: string;
  /** Reason provided for executing the trade */
  reason?: string;
  /** Timestamp of when the trade was executed */
  timestamp: string;
  /** Blockchain type of the source token */
  fromChain?: string;
  /** Blockchain type of the destination token */
  toChain?: string;
  /** Specific chain for the source token */
  fromSpecificChain?: string;
  /** Specific chain for the destination token */
  toSpecificChain?: string;
}

/**
 * Team registration request interface
 */
export interface TeamRegistrationRequest {
  /** Name of the team */
  teamName: string;
  /** Team email address */
  email: string;
  /** Description */
  description?: string;
  /** Name of the contact person */
  contactPerson: string;
  /** Ethereum wallet address (must start with 0x) */
  walletAddress: string;
  /** Metadata for the team */
  metadata?: {
    /** Array of agents associated with the team */
    agents?: Agent[];
    /** User's Telegram handle */
    userTelegram?: string;
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
  /** Description */
  description?: string;
  /** Contact person name */
  contactPerson: string;
  /** Ethereum wallet address */
  walletAddress: string;
  /** Whether the team is active */
  active: boolean;
  /** API key (only returned during registration) */
  apiKey?: string;
  /** Metadata for the team */
  metadata?: {
    /** Array of agents associated with the team */
    agents?: Agent[];
    /** User's Telegram handle */
    userTelegram?: string;
  };
  /** Account creation timestamp */
  createdAt: string;
  /** Account update timestamp */
  updatedAt?: string;
  /** Optional deactivation date */
  deactivationDate?: string | null;
  /** Optional deactivation reason */
  deactivationReason?: string | null;
  /** Whether the team is an admin */
  isAdmin?: boolean;
}

/**
 * Team API key response interface
 */
export interface TeamApiKeyResponse {
  /** Team ID */
  id: string;
  /** Team name */
  name: string;
  /** API key */
  apiKey: string;
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
  try {
    const response = await fetch("/api/teams", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(
        data.error || `Failed to fetch teams with status: ${response.status}`,
      );
      return []; // Return empty array instead of throwing error
    }

    return data.teams;
  } catch (error) {
    console.error("Error fetching teams:", error);
    return []; // Return empty array for any other errors
  }
}

/**
 * Get a team by wallet address
 *
 * @param walletAddress - Ethereum wallet address (must start with 0x)
 * @returns The team data or null if not found
 */
export async function getTeamByWalletAddress(
  walletAddress: string,
): Promise<Team | null> {
  try {
    if (!walletAddress) {
      console.error("Wallet address is required");
      return null;
    }

    // Ensure wallet address is properly formatted
    const formattedAddress = walletAddress.startsWith("0x")
      ? walletAddress
      : `0x${walletAddress}`;

    // Use our Next.js API route instead of directly accessing the admin endpoint
    const queryParams = new URLSearchParams({
      address: formattedAddress.toLowerCase(),
    });

    const response = await fetch(`/api/team-by-wallet?${queryParams}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(
        data.error || `Failed to fetch team with status: ${response.status}`,
      );
      return null;
    }

    // Return the team or null
    return data.team;
  } catch (error) {
    console.error(
      `Error fetching team by wallet address ${walletAddress}:`,
      error,
    );
    return null;
  }
}

/**
 * Competition interface based on the API specification
 */
export interface Competition {
  /** Competition ID */
  id: string;
  /** Competition name */
  name: string;
  /** Competition description (optional) */
  description?: string;
  /** External link for competition details (optional) */
  externalLink?: string;
  /** URL to competition image (optional) */
  imageUrl?: string;
  /** Competition status */
  status: "PENDING" | "ACTIVE" | "CLOSED";
  /** Type of cross-chain trading allowed in this competition */
  crossChainTradingType: "disallowAll" | "disallowXParent" | "allow";
  /** When the competition was created */
  createdAt: string;
  /** When the competition was last updated */
  updatedAt: string;
}

/**
 * Get all upcoming competitions (status=PENDING)
 *
 * @returns Array of upcoming competitions
 */
export async function getUpcomingCompetitions(): Promise<Competition[]> {
  try {
    const response = await fetch("/api/competition/upcoming", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(
        data.error ||
          `Failed to fetch upcoming competitions with status: ${response.status}`,
      );
      return []; // Return empty array instead of throwing error
    }

    return data.competitions;
  } catch (error) {
    console.error("Error fetching upcoming competitions:", error);
    return []; // Return empty array for any other errors
  }
}

/**
 * Update team profile, including the option to add or remove agents from metadata
 *
 * @param updateData - Data to update the team profile
 * @param apiKey - The team's API key for authentication
 * @returns The updated team data
 */
export async function updateTeamProfile(
  updateData: {
    contactPerson?: string;
    metadata?: {
      agents?: Agent[];
      userTelegram?: string;
    };
    imageUrl?: string;
  },
  apiKey: string,
): Promise<Team | null> {
  try {
    const response = await fetch("/api/team/update-profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(updateData),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(
        data.error ||
          `Failed to update profile with status: ${response.status}`,
      );
      return null;
    }

    return data.team;
  } catch (error) {
    console.error("Error updating team profile:", error);
    return null;
  }
}

/**
 * Get trade history for the authenticated team
 *
 * @param apiKey - The team's API key for authentication
 * @param filters - Optional filters for the trades query
 * @returns Team's trade history data or null if failed
 */
export async function getTeamTrades(
  apiKey: string,
  filters?: {
    fromToken?: string;
    toToken?: string;
    fromChain?: string;
    toChain?: string;
    fromSpecificChain?: string;
    toSpecificChain?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ teamId: string; trades: Trade[] } | null> {
  try {
    // Convert filters to query parameters if provided
    const queryParams = new URLSearchParams();
    if (filters) {
      if (filters.fromToken) queryParams.append("fromToken", filters.fromToken);
      if (filters.toToken) queryParams.append("toToken", filters.toToken);
      if (filters.fromChain) queryParams.append("fromChain", filters.fromChain);
      if (filters.toChain) queryParams.append("toChain", filters.toChain);
      if (filters.fromSpecificChain)
        queryParams.append("fromSpecificChain", filters.fromSpecificChain);
      if (filters.toSpecificChain)
        queryParams.append("toSpecificChain", filters.toSpecificChain);
      if (filters.limit !== undefined)
        queryParams.append("limit", filters.limit.toString());
      if (filters.offset !== undefined)
        queryParams.append("offset", filters.offset.toString());
    }

    // Construct the URL with query parameters
    let url = "/api/team/trades";
    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(
        data.error || `Failed to fetch trades with status: ${response.status}`,
      );
      return null;
    }

    return {
      teamId: data.teamId,
      trades: data.trades,
    };
  } catch (error) {
    console.error("Error fetching team trades:", error);
    return null;
  }
}

/**
 * Update user information in Loops
 *
 * @param email User's email
 * @param name User's name
 * @returns Success status
 */
export async function updateLoopsContact(
  email: string,
  name: string,
): Promise<boolean> {
  try {
    const response = await fetch("/api/loops-update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, name }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error updating Loops contact:", error);
    return false;
  }
}
