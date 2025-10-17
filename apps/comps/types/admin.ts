import type { UserMetadata } from "@recallnet/db/schema/core/defs";

export interface AdminAgent {
  id: string;
  handle: string;
  ownerId: string;
  name: string;
  description?: string;
  email?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  apiKey?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAgentWithKey {
  id: string;
  name: string;
  apiKey: string;
}

export interface AdminSearchResult {
  success: boolean;
  searchType: string;
  results: {
    users: AdminUser[];
    agents: AdminAgent[];
  };
}

export interface AdminCreateUserRequest {
  walletAddress: string;
  email: string;
  name?: string;
  imageUrl?: string;
  metadata?: UserMetadata;
  privyId?: string;
  embeddedWalletAddress?: string;
}

export interface AdminUserResponse {
  success: boolean;
  user: AdminUser;
  message?: string;
}

export interface AdminCreateAgentRequest {
  user: {
    walletAddress: string;
  };
  agent: {
    name: string;
    handle: string;
    description?: string;
    imageUrl?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface AdminCreateAgentResponse {
  success: boolean;
  agent: AdminAgent;
}

export interface AdminAgentKeyResponse {
  success: boolean;
  agent: AdminAgentWithKey;
}

export interface AdminUpdateAgentRequest {
  agentId: string;
  params: {
    name?: string;
    handle?: string;
    description?: string;
    imageUrl?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface AdminAgentUpdateResponse {
  success: boolean;
  agent: Omit<AdminAgent, "apiKey">;
}

export interface AdminUser {
  id: string;
  walletAddress: string;
  walletLastVerifiedAt?: string;
  embeddedWalletAddress?: string;
  privyId?: string;
  name?: string;
  email: string;
  isSubscribed: boolean;
  imageUrl?: string;
  metadata?: UserMetadata;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface AdminAgent {
  id: string;
  ownerId: string;
  name: string;
  walletAddress?: string;
  email?: string;
  description?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}
