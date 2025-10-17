import { authMiddleware } from "@/rpc/middleware/auth";
import { serializeUser } from "@/rpc/router/utils/serialize-user";

export const getProfile = authMiddleware.handler(async ({ context }) => {
  return serializeUser(context.user);
});
