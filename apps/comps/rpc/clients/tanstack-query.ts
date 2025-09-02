import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import { client } from "./client-side";

export const tanstackClient = createTanstackQueryUtils(client);
