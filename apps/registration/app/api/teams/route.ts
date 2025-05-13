import { NextResponse } from "next/server";

import { TeamApiClient } from "@/lib/api-client";

/**
 * GET handler for fetching all teams
 * This endpoint requires the ADMIN_API_KEY to be set in environment variables
 * It uses the admin-only API endpoint to fetch all teams
 *
 * @returns JSON response with teams data
 */
export async function GET() {
  try {
    // Access environment variables directly in the API route
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
    const teams = await apiClient.getAllTeams();

    return NextResponse.json({ success: true, teams });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch teams",
      },
      { status: 500 },
    );
  }
}
