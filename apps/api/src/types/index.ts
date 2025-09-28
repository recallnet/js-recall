import { Request } from "express";

/**
 * Extended Request interface for authenticated requests
 */
export interface AuthenticatedRequest extends Request {
  privyToken?: string;
  agentId?: string;
  userId?: string;
  adminId?: string;
  wallet?: string;
  isAdmin?: boolean;
  admin?: {
    id: string;
    name: string;
  };
}
