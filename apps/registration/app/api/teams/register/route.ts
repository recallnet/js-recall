import { NextRequest, NextResponse } from "next/server";

import { TeamApiClient } from "@/lib/api-client";
import { registrationSchema } from "@/lib/validation";

/**
 * POST handler for team registration
 * This endpoint uses the public registration API and doesn't require an API key
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

    // Access API URL directly from environment variables
    const apiUrl = process.env.API_URL;
    if (!apiUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing API_URL in environment variables",
        },
        { status: 500 },
      );
    }

    // Create API client without API key for public endpoint
    const apiClient = new TeamApiClient(apiUrl);

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
