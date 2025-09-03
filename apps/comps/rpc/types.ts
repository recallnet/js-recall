import { SiweMessage } from "siwe";

import { db } from "@/db";

export interface SessionData {
  nonce?: string;
  siwe?: SiweMessage;
  agentId?: string;
  userId?: string;
  adminId?: string;
  wallet?: string;
}

export type Database = typeof db;
