// NOT GOING TO BE USED
import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

interface HasTradedUpdate {
  walletAddress: string;
}

/**
 * POST handler for directly updating the is_verified table
 *
 * @param request Next.js request object
 * @returns JSON response with update result
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = (await request.json()) as HasTradedUpdate;

    // Validate required fields
    if (!body.walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Wallet address required",
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
    const normalizedWalletAddress = body.walletAddress.toLowerCase();

    // Connect to database
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
    });

    try {
      await client.connect();

      // Insert or update the wallet trading status
      // Use ON CONFLICT to handle cases where the wallet already exists
      const query = `
                INSERT INTO is_verified (wallet_address, has_traded) 
                VALUES ($1, true)
                ON CONFLICT (wallet_address) 
                DO UPDATE SET has_traded = true
            `;

      const result = await client.query(query, [normalizedWalletAddress]);

      console.log(
        `Updated trading status for wallet: ${normalizedWalletAddress} result: ${result.rowCount}`,
      );

      return NextResponse.json({
        success: true,
        message: "Trading status updated successfully",
      });
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Error updating wallet_trading_status table:", error);

    // Return success to prevent blocking the trade flow, but log the error
    return NextResponse.json({
      success: true,
      message: "Request processed (error logged)",
    });
  }
}
