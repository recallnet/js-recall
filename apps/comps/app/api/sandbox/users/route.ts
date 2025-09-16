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
  const {
    walletAddress,
    name,
    email,
    imageUrl,
    metadata,
    privyId,
    embeddedWalletAddress,
  } = user;

  // Check if user already exists in sandbox with wallet address
  const searchByWalletAddress = await sandboxAdminRequest<AdminSearchResult>(
    `/admin/search?user.walletAddress=${walletAddress}`,
  );
  if (searchByWalletAddress.results.users.length > 0) {
    const existingUser = searchByWalletAddress.results.users[0];
    return createSuccessResponse({
      success: true,
      user: existingUser,
      message: "User already exists in sandbox",
    });
  }

  // Check if user already exists in sandbox with email
  const searchByEmail = await sandboxAdminRequest<AdminSearchResult>(
    `/admin/search?user.email=${encodeURIComponent(email)}`,
  );
  if (searchByEmail.results.users.length > 0) {
    const existingUser = searchByEmail.results.users[0];
    return createSuccessResponse({
      success: true,
      user: existingUser,
      message: "User already exists in sandbox",
    });
  }

  // Create user in sandbox
  const createUserPayload = {
    walletAddress,
    name,
    email,
    userImageUrl: imageUrl || undefined,
    userMetadata: metadata || undefined,
    privyId,
    embeddedWalletAddress,
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
