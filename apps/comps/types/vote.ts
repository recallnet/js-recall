import { PaginationResponse } from "./api";

export interface Vote {
  id: string;
  userId: string;
  agentId: string;
  competitionId: string;
  createdAt: string;
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
