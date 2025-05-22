import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { agents } from "@/data-mock/fixtures";

export async function GET() {
  const cookieStore = await cookies();
  const walletAddress = cookieStore.get("wallet_address")?.value;

  if (!walletAddress) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    address: walletAddress,
    agents: agents.slice(0, 3),
    name: "User 1",
    email: "sample@developer.com",
    image: "/default_user.png",
    website: "https://maximumdev.com/github",
  });
}
