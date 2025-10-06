import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";
import { serializeUser } from "@/rpc/router/utils/serialize-user";

export const getProfile = base
  .use(authMiddleware)
  .handler(async ({ context }) => {
    return serializeUser(context.user);
  });
