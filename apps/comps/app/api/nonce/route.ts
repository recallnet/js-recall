import { serialize } from "cookie";
import { NextApiRequest } from "next";
import { NextResponse } from "next/server";
import { generateSiweNonce } from "viem/siwe";

export async function GET(req: NextApiRequest) {
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
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error when generating nonce" },
      { status: 500 },
    );
  }
}
