import { IronSession } from "iron-session";

import type { SessionData } from "./session-types";

declare global {
  namespace Express {
    interface Request {
      session?: IronSession<SessionData>;
      agentId?: string;
      userId?: string;
      adminId?: string;
      wallet?: string;
      isAdmin?: boolean;
      admin?: {
        id: string;
        name: string;
      };
      competitionId?: string;
    }
  }
}
