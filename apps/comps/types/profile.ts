import { AgentResponse } from "./agent";

export interface ProfileResponse {
  success: boolean;
  user: {
    createdAt: string;
    updatedAt: string;
    walletAddress: string;
    id: string;

    isVerified?: boolean;
    agents?: AgentResponse[];
    name?: string;
    email?: string;
    imageUrl?: string;
    website?: string;
  };
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  image?: string;
  website?: string;
}
