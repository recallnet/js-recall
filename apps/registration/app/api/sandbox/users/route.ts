import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const SANDBOX_API_URL =
  process.env.NEXT_PUBLIC_API_SANDBOX_URL || "http://localhost:3000/api";

/**
 * Register a new user in the sandbox environment (server-side only)
 * POST /api/sandbox/users
 */
export async function POST(request: NextRequest) {
  try {
    if (!ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Admin API key not configured" },
        { status: 500 },
      );
    }

    const userData = await request.json();

    // Validate required fields
    if (!userData.walletAddress) {
      return NextResponse.json(
        { success: false, error: "Wallet address is required" },
        { status: 400 },
      );
    }

    // Call external sandbox API directly
    const response = await fetch(`${SANDBOX_API_URL}/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_API_KEY}`,
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sandbox API error:", errorText);
      return NextResponse.json(
        { success: false, error: "Failed to register user in sandbox" },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sandbox user registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to register user in sandbox",
      },
      { status: 500 },
    );
  }
}
