import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RouterClient } from "@orpc/server";

import { router } from "@/rpc/router";

const link = new RPCLink({
  url: "http://localhost:3000/rpc",
  headers: () => ({
    authorization: "Bearer token",
  }),
  // fetch: <-- provide fetch polyfill fetch if needed
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

// Create a client for your router
export const client: RouterClient<typeof router> = createORPCClient(link);
