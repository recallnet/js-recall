import { NextRequest } from "next/server";

import { sandboxAdminRequest } from "@/app/api/sandbox/_lib/sandbox-config";
import {
  createSuccessResponse,
  withErrorHandling,
} from "@/app/api/sandbox/_lib/sandbox-response";
import {
  AdminCreateUserRequest,
  AdminSearchResult,
  AdminUserResponse,
} from "@/types/admin";

/**
 * POST /api/sandbox/users
 * Creates a user in the sandbox environment using provided user data
 */
async function handleCreateUser(request: NextRequest) {
  // Get user data from request body
  const userData: AdminCreateUserRequest = await request.json();

  const {
    walletAddress,
    name,
    email,
    imageUrl,
    metadata,
    privyId,
    embeddedWalletAddress,
  } = userData;

  if (!walletAddress || !email) {
    throw new Error("Wallet address and email are required");
  }

  // Check if user already exists in sandbox with wallet address
  const searchByWalletAddress = await sandboxAdminRequest<AdminSearchResult>(
    `/admin/search?user.walletAddress=${walletAddress}`,
  );
  if (searchByWalletAddress.results.users.length > 0) {
    const existingUser = searchByWalletAddress.results.users.at(0);
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
  const createUserPayload: AdminCreateUserRequest = {
    walletAddress,
    name,
    email,
    imageUrl,
    metadata,
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
