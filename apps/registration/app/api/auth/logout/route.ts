import { NextResponse } from "next/server";

/**
 * POST handler for logging out
 *
 * @returns JSON response confirming logout
 */
export async function POST() {
  try {
    // Create a response
    const response = NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });

    // Clear the auth token cookie
    response.cookies.set({
      name: "auth-token",
      value: "",
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("Error in logout handler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
