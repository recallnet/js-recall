import { AgentResponse } from "./agent";

export interface ProfileResponse {
  address: string;
  userId: string;
  isVerified: boolean;
  agents?: AgentResponse[];
  name?: string;
  email?: string;
  image?: string;
  website?: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  image?: string;
  website?: string;
}
