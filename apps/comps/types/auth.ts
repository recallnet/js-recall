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
