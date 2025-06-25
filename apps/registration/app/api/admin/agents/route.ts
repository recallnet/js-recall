import { NextRequest, NextResponse } from "next/server";

import { CreateAgentRequest } from "@/types";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";

interface AdminCreateAgentRequest {
  userWalletAddress: string;
  agent: CreateAgentRequest;
}

/**
 * Create agent using admin API (server-side only)
 */
export async function POST(request: NextRequest) {
  try {
    if (!ADMIN_API_KEY) {
      return NextResponse.json(
        { error: "Admin API key not configured" },
        { status: 500 },
      );
    }

    const body: AdminCreateAgentRequest = await request.json();
    const { userWalletAddress, agent } = body;

    if (!userWalletAddress) {
      return NextResponse.json(
        { error: "User wallet address is required" },
        { status: 400 },
      );
    }

    // Prepare payload for admin API
    const adminPayload = {
      user: {
        walletAddress: userWalletAddress,
      },
      agent: {
        name: agent.name,
        description: agent.description,
        imageUrl: agent.imageUrl,
        email: agent.email,
        metadata: agent.metadata,
      },
    };

    const response = await fetch(`${BACKEND_API_URL}/admin/agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ADMIN_API_KEY}`,
      },
      body: JSON.stringify(adminPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Admin API error:", errorText);
      return NextResponse.json(
        { error: "Failed to create agent via admin API" },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating agent via admin API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
