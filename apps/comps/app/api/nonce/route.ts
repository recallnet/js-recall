import { serialize } from "cookie";
import { NextResponse } from "next/server";
import { generateSiweNonce } from "viem/siwe";

export async function GET() {
  try {
    const nonce = generateSiweNonce();

    const cookie = serialize("session", nonce, {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 60 * 24 * 7, // One week
      path: "/",
    });

    const response = NextResponse.json({ nonce });
    response.headers.set("Set-Cookie", cookie);

    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: `Error when generating nonce: ${(err as { message: string }).message}`,
      },
      { status: 500 },
    );
  }
}
