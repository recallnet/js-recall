declare global {
  namespace Express {
    interface Request {
      agentId?: string;
      userId?: string;
      adminId?: string;
      wallet?: string;
      isAdmin?: boolean;
      admin?: {
        id: string;
        name: string;
      };
      traceId?: string;
    }
  }
}

// Note: This export is required to make TypeScript treat this file as a module
export {};
