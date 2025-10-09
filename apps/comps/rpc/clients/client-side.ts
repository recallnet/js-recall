import {
  SafeClient,
  createORPCClient,
  createSafeClient,
  onError,
} from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { RouterClient } from "@orpc/server";

import { getSiteUrl } from "@/lib/get-site-url";
import { router } from "@/rpc/router";

const link = new RPCLink({
  url: `${getSiteUrl()}/rpc`,
  interceptors: [
    onError((error) => {
      // Don't log abort errors in development (common with React StrictMode)
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        error.message;
      if (
        typeof errorMessage === "string" &&
        (errorMessage.includes("abort") || errorMessage.includes("AbortError"))
      ) {
        console.log(errorMessage);
        return;
      }
      console.error(error);
    }),
  ],
});

// Create a client for your router
export const client: RouterClient<typeof router> = createORPCClient(link);
export const safeClient: SafeClient<typeof client> = createSafeClient(client);
