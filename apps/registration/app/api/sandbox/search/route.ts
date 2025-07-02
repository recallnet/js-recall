import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const SANDBOX_API_URL =
  process.env.NEXT_PUBLIC_API_SANDBOX_URL || "http://localhost:3001/api";

/**
 * Search users and agents in the sandbox environment (server-side only)
 * GET /api/sandbox/search
 *
 * Supports new search pattern from PR #770:
 * - user.walletAddress=0x1234
 * - agent.name=foo
 * - join (boolean to perform left join and get user's agents)
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

    // Extract all search parameters and pass them through
    // The new API supports structured queries like user.walletAddress, agent.name, etc.
    const params: Record<string, string> = {};

    searchParams.forEach((value, key) => {
      if (value !== null && value !== "") {
        params[key] = value;
      }
    });

    // Build query string for external API
    const queryString = new URLSearchParams(params).toString();
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
