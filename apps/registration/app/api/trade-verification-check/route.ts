import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

/**
 * GET handler for checking if a wallet address has traded
 *
 * @param request Next.js request object with walletAddress as query parameter
 * @returns JSON response with verification status
 */
export async function GET(request: NextRequest) {
  try {
    // Get wallet address from query parameters
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");

    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address is required as query parameter",
        },
        { status: 400 },
      );
    }

    // Validate DATABASE_URL environment variable
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL environment variable is not set");
      return NextResponse.json(
        {
          success: false,
          error: "Database configuration error",
        },
        { status: 500 },
      );
    }

    // Normalize wallet address to lowercase
    const normalizedWalletAddress = walletAddress.toLowerCase();

    // Connect to database
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      await client.connect();

      // Query to check if wallet exists and has_traded is true
      const query = `
                SELECT wallet_address, has_traded 
                FROM is_verified 
                WHERE wallet_address = $1 AND has_traded = true
            `;

      const result = await client.query(query, [normalizedWalletAddress]);

      const hasTraded = result.rows.length > 0;

      console.log(
        `Checked trading status for wallet: ${normalizedWalletAddress}, has_traded: ${hasTraded}`,
      );

      return NextResponse.json({
        success: true,
        walletAddress: normalizedWalletAddress,
        hasTraded,
        message: hasTraded ? "Wallet has traded" : "Wallet has not traded",
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Error checking wallet trading status:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check trading status",
      },
      { status: 500 },
    );
  }
}
