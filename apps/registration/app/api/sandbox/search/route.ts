import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const SANDBOX_API_URL =
  process.env.NEXT_PUBLIC_API_SANDBOX_URL || "http://localhost:3001/api";

/**
 * Search users and agents in the sandbox environment (server-side only)
 * GET /api/sandbox/search
 */
export async function GET(request: NextRequest) {
  try {
    if (!ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Admin API key not configured" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const params = {
      email: searchParams.get("email") || undefined,
      name: searchParams.get("name") || undefined,
      walletAddress: searchParams.get("walletAddress") || undefined,
      status: searchParams.get("status") || undefined,
      searchType: searchParams.get("searchType") || undefined,
    };

    // Filter out undefined values and ensure type safety
    const cleanParams: Record<string, string> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanParams[key] = value;
      }
    });

    // Build query string for external API
    const queryString = new URLSearchParams(cleanParams).toString();
    const searchUrl = `${SANDBOX_API_URL}/admin/search${queryString ? `?${queryString}` : ""}`;

    // Call external sandbox API directly
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sandbox API error:", errorText);
      return NextResponse.json(
        { success: false, error: "Failed to search sandbox" },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sandbox search error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to search sandbox",
      },
      { status: 500 },
    );
  }
}
