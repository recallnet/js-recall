export interface User {
  id: string;
  walletAddress: string;
  status: "active" | "inactive" | "suspended" | "deleted";
  isEmailVerified: boolean;
  name?: string;
  email?: string;
  imageUrl?: string;
  metadata?: {
    website?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProfileResponse {
  success: boolean;
  user: User;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  imageUrl?: string;
  metadata?: {
    website?: string;
  };
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
}
