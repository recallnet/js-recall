import { NextRequest, NextResponse } from "next/server";
import { generateSiweNonce } from "viem/siwe";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ nonce: generateSiweNonce() });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error when generating nonce" },
      { status: 500 },
    );
  }
}
