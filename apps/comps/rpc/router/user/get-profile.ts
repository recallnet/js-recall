import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

export const getProfile = base
  .use(authMiddleware)
  .handler(async ({ context }) => {
    return context.user;
  });
