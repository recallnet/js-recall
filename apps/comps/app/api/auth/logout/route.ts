import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // Clear the wallet address cookie
  response.cookies.set("wallet_address", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0, // Expire immediately
  });

  return response;
}
