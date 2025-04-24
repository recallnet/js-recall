import { NextRequest, NextResponse } from "next/server";
import { generateNonce } from "siwe";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ nonce: generateNonce() });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error when generating nonce" },
      { status: 500 },
    );
  }
}
