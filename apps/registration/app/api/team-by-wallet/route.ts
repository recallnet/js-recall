import { NextRequest, NextResponse } from "next/server";

import { TeamApiClient } from "@/lib/api-client";

/**
 * GET handler for fetching a team by wallet address
 *
 * @param request Next.js request object
 * @returns JSON response with team data or null
 */
export async function GET(request: NextRequest) {
  try {
    // Get wallet address from query params
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get("address");

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address is required",
        },
        { status: 400 },
      );
    }

    // Access API URL from environment variables
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

    // Get admin API key from environment if needed
    const adminApiKey = process.env.ADMIN_API_KEY;

    // Set up server-side client with admin API key if available
    const client = adminApiKey
      ? new TeamApiClient(apiUrl, adminApiKey)
      : new TeamApiClient(apiUrl);

    // Make the API request to search for teams
    try {
      // Search teams by the wallet address
      const searchParams = { walletAddress };
      const teams = await client.searchTeams(searchParams);

      if (teams && teams.length > 0) {
        // Return the first matching team
        return NextResponse.json({ success: true, team: teams[0] });
      } else {
        // No team found with this wallet address
        return NextResponse.json({ success: true, team: null });
      }
    } catch (error) {
      console.error("Error searching teams:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to search teams",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in team-by-wallet handler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
