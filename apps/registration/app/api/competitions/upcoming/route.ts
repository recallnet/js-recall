import { NextResponse } from "next/server";

import { TeamApiClient } from "@/lib/api-client";

/**
 * GET handler for fetching upcoming competitions
 *
 * @returns JSON response with upcoming competitions
 */
export async function GET() {
  try {
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

    // Make the API request to get upcoming competitions
    try {
      const competitions = await client.getUpcomingCompetitions();
      return NextResponse.json({ success: true, competitions });
    } catch (error) {
      console.error("Error fetching upcoming competitions:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch upcoming competitions",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in upcoming competitions handler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
