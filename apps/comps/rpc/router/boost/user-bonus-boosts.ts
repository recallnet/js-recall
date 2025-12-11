import { base } from "@/rpc/context/base";
import { authMiddleware } from "@/rpc/middleware/auth";

export const userBonusBoosts = base
  .use(authMiddleware)
  .handler(async ({ context, errors }) => {
    const res = await context.boostService.getUserBonusBoosts(context.user.id);
    if (res.isErr()) {
      throw errors.INTERNAL({ message: res.error.message });
    } else {
      return res.value;
    }
  });
