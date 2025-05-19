import { NextRequest, NextResponse } from "next/server";

import { TeamApiClient } from "@/lib/api-client";

/**
 * Type definition for trade filters
 */
type TradeFilters = {
  fromToken?: string;
  toToken?: string;
  fromChain?: string;
  toChain?: string;
  fromSpecificChain?: string;
  toSpecificChain?: string;
  limit?: number;
  offset?: number;
};

/**
 * GET /api/team/trades - Get trades for the authenticated team
 *
 * Proxies the request to the backend API, forwarding the API key from the request
 */
export async function GET(request: NextRequest) {
  try {
    // Get API key from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid API key",
        },
        { status: 401 },
      );
    }

    // Extract the API key from the Authorization header
    const apiKey = authHeader.substring(7);
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid API key format",
        },
        { status: 401 },
      );
    }

    // Initialize the API client with the API key
    const apiUrl = process.env.API_URL || "http://localhost:3000";
    const apiClient = new TeamApiClient(apiUrl, apiKey);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;

    // Build filter object from query parameters
    const filters: TradeFilters = {};

    // Handle string parameters
    const stringParams: (keyof TradeFilters)[] = [
      "fromToken",
      "toToken",
      "fromChain",
      "toChain",
      "fromSpecificChain",
      "toSpecificChain",
    ];

    stringParams.forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        // This is safe because we explicitly defined the param as a key of TradeFilters
        (filters[param] as string) = value;
      }
    });

    // Handle numeric parameters
    const limit = searchParams.get("limit");
    if (limit) {
      filters.limit = parseInt(limit, 10);
    }

    const offset = searchParams.get("offset");
    if (offset) {
      filters.offset = parseInt(offset, 10);
    }

    // Call the API client to get team trades
    const response = await apiClient.getTeamTrades(
      Object.keys(filters).length > 0 ? filters : undefined,
    );

    // Return the trades data
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching team trades:", error);

    // If the error object has a structured response, use it
    if (
      typeof error === "object" &&
      error !== null &&
      "success" in error &&
      "error" in error &&
      "status" in error
    ) {
      const errorObj = error as {
        success: boolean;
        error: string;
        status: number;
      };
      return NextResponse.json(
        { success: false, error: errorObj.error },
        { status: errorObj.status },
      );
    }

    // Otherwise, return a generic server error
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch trades",
      },
      { status: 500 },
    );
  }
}
