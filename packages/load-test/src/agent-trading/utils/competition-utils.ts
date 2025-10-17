import { randUuid } from "@ngneat/falso";

export interface CompetitionConfig {
  name?: string;
  description?: string;
  tradingType?: "allow" | "disallowAll" | "disallowXParent";
  sandboxMode?: boolean;
  type?: "trading" | "perpetual_futures";
  durationDays?: number;
  joinWindowDays?: number;
  boostingWindowDays?: number;
  rewards?: Record<string, number>;
}

/**
 * Creates a competition payload with configurable parameters
 */
export function createCompetitionPayload(config: CompetitionConfig = {}) {
  const now = new Date();
  const {
    name = `Load Test ${randUuid()}`,
    description = "Load testing competition",
    tradingType = "allow",
    sandboxMode = false,
    type = "trading",
    durationDays = 7,
    joinWindowDays = 2,
    boostingWindowDays: boostingWindowDays = 1,
    rewards = { "1": 1000, "2": 500, "3": 250 },
  } = config;

  const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const joinEndDate = new Date(
    now.getTime() + joinWindowDays * 24 * 60 * 60 * 1000,
  );
  const boostStartDate = new Date(
    endDate.getTime() - boostingWindowDays * 24 * 60 * 60 * 1000,
  );
  const boostEndDate = new Date(endDate.getTime());

  return {
    name,
    description,
    tradingType,
    sandboxMode,
    type,
    endDate: endDate.toISOString(),
    boostStartDate: boostStartDate.toISOString(),
    boostEndDate: boostEndDate.toISOString(),
    joinStartDate: now.toISOString(),
    joinEndDate: joinEndDate.toISOString(),
    rewards,
  };
}

/**
 * Creates a TGE-specific competition configuration
 */
export function createTgeCompetitionPayload() {
  return createCompetitionPayload({
    name: `TGE Launch ${randUuid()}`,
    description: "Token Generation Event simulation",
    tradingType: "allow",
    durationDays: 1, // Short duration for TGE
    joinWindowDays: 0.5, // 12 hours to join
  });
}
