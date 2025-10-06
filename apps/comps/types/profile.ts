export interface User {
  id: string;
  walletAddress: string;
  walletLastVerifiedAt?: string;
  embeddedWalletAddress?: string;
  privyId?: string;
  status: "active" | "inactive" | "suspended" | "deleted";
  name?: string;
  email: string;
  isSubscribed: boolean;
  imageUrl?: string;
  metadata?: {
    website?: string;
  };
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface ProfileResponse {
  success: boolean;
  user: User;
}

export interface UpdateProfileRequest {
  name?: string;
  imageUrl?: string;
  metadata?: {
    website?: string;
  };
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
}

export interface LinkWalletRequest {
  walletAddress: string;
}

export interface UserSubscriptionResponse {
  success: boolean;
  userId: string;
  isSubscribed: boolean;
}
