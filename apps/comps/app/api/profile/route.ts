import {cookies} from "next/headers";
import {NextResponse} from "next/server";

import {store} from "@/data-mock/db";
import {ProfileResponse} from "@/types/profile";

// In-memory storage for user profiles
const userProfiles = new Map<string, ProfileResponse>();

export async function GET() {
  const cookieStore = await cookies();
  const walletAddress = cookieStore.get("wallet_address")?.value;

  if (!walletAddress) {
    return NextResponse.json({error: "Not authenticated"}, {status: 401});
  }

  const userProfile = userProfiles.get(walletAddress) || {
    address: walletAddress,
    userId: walletAddress,
    isVerified: true,
  };

  userProfile.agents = store.agents.filter(
    (agent) => agent.userId === walletAddress,
  );
  console.log({agents: store.agents});

  return NextResponse.json(userProfile);
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const walletAddress = cookieStore.get("wallet_address")?.value;

  if (!walletAddress) {
    return NextResponse.json({error: "Not authenticated"}, {status: 401});
  }

  try {
    const data = await request.json();

    const existingProfile = userProfiles.get(walletAddress) || {
      address: walletAddress,
      userId: walletAddress,
      isVerified: true,
    };

    // Update profile with new data
    const updatedProfile: ProfileResponse = {
      ...existingProfile,
      ...data,
      address: walletAddress, // Ensure address is always set to the authenticated wallet
      userId: existingProfile.userId, // Preserve the userId
    };

    // Store updated profile
    userProfiles.set(walletAddress, updatedProfile);

    return NextResponse.json(updatedProfile);
  } catch {
    return NextResponse.json(
      {error: "Invalid request data"},
      {status: 400},
    );
  }
}
