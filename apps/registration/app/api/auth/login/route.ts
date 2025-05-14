import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";

import { TeamApiClient } from "@/lib/api-client";

/**
 * JWT expiration time in seconds
 */
const JWT_EXPIRY = 7 * 24 * 60 * 60; // 1 week

/**
 * Secret key for JWT signing
 * In production, this should be set as an environment variable
 */
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Verify a Ethereum signature
 *
 * @param message The message that was signed
 * @param signature The signature to verify
 * @param address The address to verify against
 * @returns Whether the signature is valid
 */
function verifySignature(
  message: string,
  signature: string,
  address: string,
): boolean {
  try {
    // Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    // Compare the recovered address with the claimed address (case-insensitive)
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    console.error("Error verifying signature:", error);
    return false;
  }
}

/**
 * POST handler for login via SIWE (Sign-In with Ethereum)
 *
 * @param request The incoming request
 * @returns JSON response with authentication result
 */
export async function POST(request: NextRequest) {
  try {
    // Get the request body
    const body = await request.json();
    const { wallet, signature, message } = body;

    // Validate the request
    if (!wallet || !signature || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: wallet, signature, or message",
        },
        { status: 400 },
      );
    }

    // Extract nonce from the message
    const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
    if (!nonceMatch || !nonceMatch[1]) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid message format. Message must contain a nonce.",
        },
        { status: 400 },
      );
    }
    const signedNonce = nonceMatch[1];

    // Get the nonce from the cookie
    const storedNonce = request.cookies.get("auth-nonce")?.value;
    if (!storedNonce) {
      return NextResponse.json(
        {
          success: false,
          error: "No nonce found in session. Please request a new nonce.",
        },
        { status: 400 },
      );
    }

    // Verify that the nonces match
    if (signedNonce !== storedNonce) {
      return NextResponse.json(
        {
          success: false,
          error: "Nonce mismatch. Please request a new nonce.",
        },
        { status: 400 },
      );
    }

    // Verify the signature
    const isSignatureValid = verifySignature(message, signature, wallet);
    if (!isSignatureValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid signature",
        },
        { status: 401 },
      );
    }

    // Check if the user exists by wallet address
    const apiUrl = process.env.API_URL;
    const adminApiKey = process.env.ADMIN_API_KEY;

    if (!apiUrl || !adminApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Server configuration error",
        },
        { status: 500 },
      );
    }

    // Set up API client
    const apiClient = new TeamApiClient(apiUrl, adminApiKey);

    // Search for a team with the wallet address
    const searchParams = { walletAddress: wallet };
    let teams;

    try {
      teams = await apiClient.searchTeams(searchParams);
    } catch (error) {
      console.error("Error searching for team:", error);
      teams = [];
    }

    // Find the team or set to null
    const team = teams && teams.length > 0 ? teams[0] : null;

    // Create a JWT token
    const tokenData = {
      wallet,
      teamId: team?.id,
      isAdmin: team?.isAdmin || false,
    };

    const token = jwt.sign(tokenData, JWT_SECRET, {
      expiresIn: JWT_EXPIRY,
    });

    // Create the response
    const response = NextResponse.json({
      success: true,
      wallet,
      teamId: team?.id,
    });

    // Set the JWT token in a cookie
    response.cookies.set({
      name: "auth-token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: JWT_EXPIRY, // Seconds
    });

    // Clear the nonce cookie to prevent replay attacks
    response.cookies.set({
      name: "auth-nonce",
      value: "",
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("Error in login handler:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
