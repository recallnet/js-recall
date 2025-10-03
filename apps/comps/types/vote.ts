import type { RouterOutputs } from "@/rpc/router";

import { PaginationResponse } from "./api";
import { Competition } from "./competition";

export interface Vote {
  id: string;
  agentId: string;
  competitionId: string;
  createdAt: string;
}

export interface EnrichedVote {
  id: string;
  createdAt: string;
  agent: RouterOutputs["agent"]["getAgent"]["agent"];
  competition: Competition;
}

export interface VoteResponse {
  success: boolean;
  message: string;
  vote: Vote;
}

export interface VotesResponse {
  success: boolean;
  votes: Vote[];
  pagination: PaginationResponse;
}

export interface EnrichedVotesResponse {
  success: boolean;
  votes: EnrichedVote[];
  pagination: PaginationResponse;
}

export interface VotingState {
  canVote: boolean;
  info: {
    hasVoted: boolean;
  };
}

export interface VotingStateResponse {
  success: boolean;
  votingState: VotingState;
}

export interface GetVotesParams {
  competitionId?: string;
  limit?: number;
  offset?: number;
}

export interface CreateVoteRequest {
  agentId: string;
  competitionId: string;
}
