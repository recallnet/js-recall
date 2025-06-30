import { NextRequest, NextResponse } from "next/server";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const SANDBOX_API_URL =
  process.env.NEXT_PUBLIC_API_SANDBOX_URL || "http://localhost:3000/api";

/**
 * Register a new agent in the sandbox environment (server-side only)
 * POST /api/sandbox/agents
 */
export async function POST(request: NextRequest) {
  try {
    if (!ADMIN_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Admin API key not configured" },
        { status: 500 },
      );
    }

    const agentData = await request.json();

    // Validate required fields
    if (
      !agentData.user ||
      (!agentData.user.id && !agentData.user.walletAddress)
    ) {
      return NextResponse.json(
        { success: false, error: "User ID or wallet address is required" },
        { status: 400 },
      );
    }

    if (!agentData.agent || !agentData.agent.name) {
      return NextResponse.json(
        { success: false, error: "Agent name is required" },
        { status: 400 },
      );
    }

    // Call external sandbox API directly
    const response = await fetch(`${SANDBOX_API_URL}/admin/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_API_KEY}`,
      },
      body: JSON.stringify(agentData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sandbox API error:", errorText);
      return NextResponse.json(
        { success: false, error: "Failed to register agent in sandbox" },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sandbox agent registration error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to register agent in sandbox",
      },
      { status: 500 },
    );
  }
}
