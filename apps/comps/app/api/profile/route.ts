import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const walletAddress = cookieStore.get("wallet_address")?.value;

  if (!walletAddress) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ address: walletAddress });
}
