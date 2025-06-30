import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const SANDBOX_API_URL =
  process.env.NEXT_PUBLIC_API_SANDBOX_URL || "http://localhost:3000/api";

/**
 * Get agent API key from the sandbox environment (server-side only)
 * GET /api/sandbox/agents/[agentId]/key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    if (!ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Admin API key not configured" },
        { status: 500 },
      );
    }

    const { agentId } = await params;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "Agent ID is required" },
        { status: 400 },
      );
    }

    // Call external sandbox API directly
    const response = await fetch(
      `${SANDBOX_API_URL}/admin/agents/${agentId}/key`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_API_KEY}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sandbox API error:", errorText);
      return NextResponse.json(
        { success: false, error: "Failed to get agent API key from sandbox" },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sandbox get agent API key error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get agent API key from sandbox",
      },
      { status: 500 },
    );
  }
}
