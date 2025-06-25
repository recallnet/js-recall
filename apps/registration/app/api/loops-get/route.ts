import { NextRequest, NextResponse } from "next/server";

/**
 * GET handler for fetching user information from Loops by email
 *
 * @param request Next.js request object
 * @returns JSON response with user data from Loops
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    // Validate required email parameter
    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "Email parameter is required",
        },
        { status: 400 },
      );
    }

    // Get the Loops API key from environment variables
    const loopsApiKey = process.env.LOOPS_API_KEY;

    if (!loopsApiKey) {
      console.error("Missing LOOPS_API_KEY in environment variables");
      return NextResponse.json(
        {
          success: false,
          error: "Loops API not configured",
        },
        { status: 500 },
      );
    }

    // Send request to Loops API to find the contact
    const response = await fetch(
      `https://app.loops.so/api/v1/contacts/find?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${loopsApiKey}`,
        },
      },
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Loops API error:", responseData);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch user from Loops",
          details: responseData,
        },
        { status: response.status },
      );
    }

    // Return the user data from Loops
    return NextResponse.json({
      success: true,
      user: responseData[0] || null, // Loops returns an array, get first result
    });
  } catch (error) {
    console.error("Error fetching from Loops:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
