/**
 * Response interface for nonce generation
 */
export interface NonceResponse {
  nonce: string;
}

/**
 * Request interface for login with wallet signature
 */
export interface LoginRequest {
  wallet: string;
  signature: string;
  message: string;
}

/**
 * Response interface for successful login
 */
export interface LoginResponse {
  userId: string;
  wallet: string;
}

/**
 * User interface
 */
export interface User {
  id: string;
  walletAddress: string;
  status: "active" | "inactive" | "suspended" | "deleted";
  name?: string;
  email?: string;
  imageUrl?: string;
  metadata?: {
    website?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Response interface for profile/user data
 */
export interface ProfileResponse {
  success: boolean;
  user: User;
}

/**
 * Request interface for updating profile
 */
export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  imageUrl?: string;
  metadata?: {
    website?: string;
  };
}
