import { NextResponse } from "next/server";

import { TeamApiClient } from "@/lib/api-client";

/**
 * GET handler for fetching upcoming competitions
 *
 * @param request Next.js request object
 * @returns JSON response with upcoming competitions
 */
export async function GET() {
  try {
    // Get env api key
    const apiKey = process.env.ADMIN_API_KEY;

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

    // Set up server-side client with the team's API key from the request
    const client = new TeamApiClient(apiUrl, apiKey);

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
