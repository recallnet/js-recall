import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { TeamApiClient } from "@/lib/api-client";
import { registrationSchema } from "@/lib/validation";

import { authOptions } from "../../auth/[...nextauth]/route";

/**
 * POST handler for team registration
 * This endpoint uses the admin-restricted registration API and requires an admin API key
 *
 * @param request Next.js request object
 * @returns JSON response with registration result
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate request data
    const validationResult = registrationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid registration data",
          details: validationResult.error.format(),
        },
        { status: 400 },
      );
    }

    // Get the auth session using NextAuth
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session || !session.user || !session.user.address) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
        },
        { status: 401 },
      );
    }

    // Compare the wallet address in the form with the authenticated wallet
    if (
      session.user.address.toLowerCase() !== body.walletAddress.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address must match the connected wallet",
        },
        { status: 403 },
      );
    }

    // Access API URL and admin API key from environment variables
    const apiUrl = process.env.API_URL;
    const adminApiKey = process.env.ADMIN_API_KEY;

    if (!apiUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing API_URL in environment variables",
        },
        { status: 500 },
      );
    }

    if (!adminApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing ADMIN_API_KEY in environment variables",
        },
        { status: 500 },
      );
    }

    // Create API client with admin API key
    const apiClient = new TeamApiClient(apiUrl, adminApiKey);

    // Call the registration endpoint
    const team = await apiClient.registerTeam({
      teamName: body.teamName,
      email: body.email,
      contactPerson: body.contactPerson,
      walletAddress: body.walletAddress,
      metadata: body.metadata,
    });

    return NextResponse.json({ success: true, team }, { status: 201 });
  } catch (error) {
    console.error("Error registering team:", error);

    // Check for specific error types
    if (error && typeof error === "object" && "status" in error) {
      const typedError = error as {
        success: false;
        error: string;
        status: number;
      };
      return NextResponse.json(
        { success: false, error: typedError.error },
        { status: typedError.status },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to register team",
      },
      { status: 500 },
    );
  }
}
