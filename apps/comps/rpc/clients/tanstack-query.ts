import { RouterUtils, createTanstackQueryUtils } from "@orpc/tanstack-query";

import { client } from "./client-side";

export const tanstackClient: RouterUtils<typeof client> =
  createTanstackQueryUtils(client);
