import { verifyMessage } from "@wagmi/core";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SiweMessage, parseSiweMessage } from "viem/siwe";

import { serverConfig } from "@/wagmi-config";

const TIME_LIMIT = 24 * 3600 * 1000; // 1 day before sig expires

const validateMessage = async (req: NextRequest, msg: SiweMessage) => {
  const host = req.headers.get("host");
  const cookieStore = await cookies();
  const nonce = cookieStore.get("session")?.value;

  if (msg.domain != host) {
    throw new Error("Invalid domain");
  }
  if (msg.chainId != 84532) {
    throw new Error("Invalid chain id");
  }
  if (msg.nonce != nonce) {
    throw new Error("Invalid nonce");
  }
  if (
    msg.issuedAt &&
    new Date((msg as { issuedAt: Date }).issuedAt).getTime() <
      Date.now() - TIME_LIMIT
  ) {
    throw new Error("Invalid issue date");
  }
};

export async function POST(req: NextRequest) {
  try {
    const { message, signature } = await req.json();

    if (!message || !signature) {
      return NextResponse.json(
        { error: "Missing message or signature" },
        { status: 400 },
      );
    }

    const siweMessage = parseSiweMessage(message) as SiweMessage;
    await validateMessage(req, siweMessage);

    const result = await verifyMessage(serverConfig(), {
      address: siweMessage.address as `0x${string}`,
      message: message,
      signature,
    });

    if (!result) throw new Error("signature validation error");

    const response = NextResponse.json({
      userId: siweMessage.address,
      wallet: siweMessage.address,
    });

    response.cookies.set("wallet_address", siweMessage.address, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TIME_LIMIT / 1000, // Convert to seconds
    });

    return response;
  } catch (err) {
    console.error("[SIWE LOGIN ERROR]", err);
    return NextResponse.json(
      { error: "Invalid SIWE message or signature" },
      { status: 400 },
    );
  }
}
