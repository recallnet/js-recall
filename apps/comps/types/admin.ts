export interface SandboxUser {
  id: string;
  walletAddress: string;
  name?: string;
  email?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAgent {
  id: string;
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
    users?: AdminUser[];
    agents?: AdminAgent[];
  };
}

export interface AdminUserResponse {
  success: boolean;
  user: AdminUser;
  message?: string;
}

export interface AdminCreateAgentResponse {
  success: boolean;
  agent: AdminAgent;
}

export interface AdminAgentKeyResponse {
  success: boolean;
  agent: AdminAgentWithKey;
}

export interface AdminAgentUpdateResponse {
  success: boolean;
  agent: Omit<AdminAgent, "apiKey">;
}

export interface AdminUser {
  id: string;
  walletAddress: string;
  name?: string;
  email?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
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
  apiKey?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
