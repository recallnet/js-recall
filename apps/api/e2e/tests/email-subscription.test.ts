import { describe, expect, test } from "vitest";

import { UserProfileResponse } from "@/e2e/utils/api-types.js";

import { ApiClient } from "../utils/api-client.js";
import { createTestPrivyUser } from "../utils/privy.js";

// TODO: the email subscription service only executes if we set Loops API key and config info.
// We need to mock the API and override it in tests in order for the `isSubscribed` field to be
// correctly set to `true` in the user profile. Else, it's always `false`.
describe("Email Subscription", () => {
  test("should subscribe user to email list upon user creation", async () => {
    const client = new ApiClient();
    const testUser = createTestPrivyUser({
      name: "Alice Test",
      email: "alice@example.com",
    });
    const { name, email, privyId } = testUser;
    const authResult = await client.authenticateWithPrivy(testUser);
    expect(authResult.success).toBe(true);

    const { user, success } =
      (await client.getUserProfile()) as UserProfileResponse;
    expect(success).toBe(true);
    expect(user.name).toBe(name);
    expect(user.email).toBe(email);
    expect(user.privyId).toBe(privyId);
    // TODO: ideally, this is `true` but tests cannot currently override the behavior of the email service
    expect(user.isSubscribed).toBe(false);
  });
});
