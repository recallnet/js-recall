import { NextRequest, NextResponse } from "next/server";

import { Agent } from "@/lib/api";
import { TeamApiClient } from "@/lib/api-client";

/**
 * PUT handler for updating a team's profile
 *
 * @param request Next.js request object containing the update data
 * @returns JSON response with updated team data
 */
export async function PUT(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid authorization token",
        },
        { status: 401 },
      );
    }

    // Extract the API key from the header
    const apiKey = authHeader.replace("Bearer ", "");

    // Parse request body
    const updateData = await request.json();

    // Validate the data
    if (
      !updateData ||
      (typeof updateData === "object" && Object.keys(updateData).length === 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No update data provided",
        },
        { status: 400 },
      );
    }

    // Extract only the allowed fields to update
    const { contactPerson, metadata, imageUrl } = updateData;
    const validUpdateData: {
      contactPerson?: string;
      metadata?: {
        agents?: Agent[];
        userTelegram?: string;
      };
      imageUrl?: string;
    } = {};

    if (contactPerson !== undefined)
      validUpdateData.contactPerson = contactPerson;
    if (metadata !== undefined) validUpdateData.metadata = metadata;
    if (imageUrl !== undefined) validUpdateData.imageUrl = imageUrl;

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

    // Set up server-side client with the user's API key
    const client = new TeamApiClient(apiUrl, apiKey);

    // Make the API request to update the team profile
    try {
      // Since we're using the team's own API key, we identify the team through the API key
      const updatedTeam = await client.updateTeamProfile(validUpdateData);
      return NextResponse.json({ success: true, team: updatedTeam });
    } catch (error) {
      console.error("Error updating team profile:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update team profile",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error in update-profile handler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
