import { Address } from "viem";
import { baseSepolia } from "viem/chains";

export const DEFAULT_REDIRECT_URL = "/competitions";

export const AGENT_SKILLS = [
  "Crypto Trading",
  "Traditional Investing",
  "Sports Betting",
  "Prediction Markets",
  "Social and Chat",
  "Art & Video Creation",
  "Programming / Coding",
  "Deep Research",
  "Other",
] as const;

export const RECALL_TOKEN_ADDRESS: Record<string, Address> = {
  [baseSepolia.id]: "0x7323CC5c18DEcCD3e918bbccff80333961d85a88",
};

export const RECALL_STAKING_CONTRACT_ADDRESS: Record<string, Address> = {
  [baseSepolia.id]: "0x4F93a503972F1d35244C43fD76e0e880e75c14aC",
};

export const RECALL_REWARD_ALLOCATION_CONTRACT_ADDRESS: Record<
  string,
  Address
> = {
  [baseSepolia.id]: "0x08EB26382777B344e21d0EbE92bB4B32a5FF63b6",
};
