import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * Nonce expiration time in milliseconds
 */
const NONCE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * GET handler for generating a nonce
 *
 * @returns JSON response with a nonce for authentication
 */
export async function GET() {
  try {
    // Generate a random nonce
    const nonce = crypto.randomBytes(16).toString("hex");

    // Create a response with the nonce
    const response = NextResponse.json({
      success: true,
      nonce,
    });

    // Set the nonce in a cookie
    response.cookies.set({
      name: "auth-nonce",
      value: nonce,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: NONCE_EXPIRY / 1000, // Convert to seconds for cookie
    });

    return response;
  } catch (error) {
    console.error("Error generating nonce:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate nonce",
      },
      { status: 500 },
    );
  }
}
