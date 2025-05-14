import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

/**
 * Secret key for JWT verification
 * Must match the key used for signing in the login route
 */
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Verify JWT token from cookie
 *
 * @param token The JWT token to verify
 * @returns The decoded token payload or null if invalid
 */
function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      wallet: string;
      teamId?: string;
      isAdmin: boolean;
    };
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

/**
 * GET handler to check authentication status
 *
 * @param request The incoming request
 * @returns JSON response with authentication status
 */
export async function GET(request: NextRequest) {
  try {
    // Get the auth token from the cookie
    const authToken = request.cookies.get("auth-token")?.value;

    if (!authToken) {
      return NextResponse.json({
        success: false,
        authenticated: false,
        message: "Not authenticated",
      });
    }

    // Verify the token
    const userData = verifyToken(authToken);

    if (!userData) {
      // Token is invalid, clear the cookie
      const response = NextResponse.json({
        success: false,
        authenticated: false,
        message: "Invalid or expired token",
      });

      response.cookies.set({
        name: "auth-token",
        value: "",
        expires: new Date(0),
      });

      return response;
    }

    // Return the user data
    return NextResponse.json({
      success: true,
      authenticated: true,
      wallet: userData.wallet,
      teamId: userData.teamId,
      isAdmin: userData.isAdmin,
    });
  } catch (error) {
    console.error("Error in session handler:", error);
    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
