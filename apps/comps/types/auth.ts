import { AgentResponse } from "./agent";

export interface NonceResponse {
  nonce: string;
}

export interface LoginRequest {
  wallet: string;
  signature: string;
  message: string;
}

export interface LoginResponse {
  userId: string;
  wallet: string;
}

export interface ProfileResponse {
  address: string;
  agents: AgentResponse[];
  name: string;
  email: string;
  image: string;
  website: string;
}
