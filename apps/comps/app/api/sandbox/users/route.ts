import { NextRequest } from "next/server";

import {
  extractSessionCookie,
  mainApiRequest,
  sandboxAdminRequest,
} from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import { AdminSearchResult, AdminUserResponse } from "@/types/admin";
import { ProfileResponse } from "@/types/profile";

/**
 * POST /api/sandbox/users
 * Creates a user in the sandbox environment by:
 * 1. Fetching user profile from the base API using session cookie
 * 2. Checking if user already exists in sandbox
 * 3. Creating user in sandbox if not found
 */
async function handleCreateUser(request: NextRequest) {
  // Extract session cookie
  const sessionCookie = extractSessionCookie(request);

  // Fetch user profile from the base API
  const profileData = await mainApiRequest<ProfileResponse>(
    "/user/profile",
    sessionCookie,
  );
  const { user } = profileData;
  const { walletAddress, name, email, imageUrl, metadata } = user;

  // Check if user already exists in sandbox
  const searchData = await sandboxAdminRequest<AdminSearchResult>(
    `/admin/search?user.walletAddress=${walletAddress}`,
  );

  // If user already exists, return the existing user
  if (searchData.results?.users && searchData.results.users.length > 0) {
    const existingUser = searchData.results.users[0];
    return createSuccessResponse({
      success: true,
      user: existingUser,
      message: "User already exists in sandbox",
    });
  }

  // Create user in sandbox
  const createUserPayload = {
    walletAddress,
    name: name || undefined,
    email: email || undefined,
    userImageUrl: imageUrl || undefined,
    userMetadata: metadata || undefined,
  };

  const createData = await sandboxAdminRequest<AdminUserResponse>(
    "/admin/users",
    {
      method: "POST",
      body: JSON.stringify(createUserPayload),
    },
  );

  return createSuccessResponse(createData);
}

export const POST = withErrorHandling(handleCreateUser);
