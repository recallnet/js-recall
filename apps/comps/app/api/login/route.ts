import { verifyMessage } from "@wagmi/core";
import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";

import { config } from "@/wagmi-config";

const TIME_LIMIT = 24 * 3600 * 1000; // 1 day before sig expires

const validateMessage = (req: NextRequest, msg: SiweMessage) => {
  const host = req.headers.get("host"); // e.g. "localhost:3000"

  if (msg.domain != host) {
    throw new Error("Invalid domain");
  }
  if (msg.chainId != 84532) {
    throw new Error("Invalid chain id");
  }
  if (msg.nonce != "" && false) {
    // we should get nonce from some db
    throw new Error("Invalid nonce");
  }
  if (new Date(msg.issuedAt as string).getTime() < Date.now() - TIME_LIMIT) {
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

    const siweMessage = new SiweMessage(message);
    validateMessage(req, siweMessage);

    const result = await verifyMessage(config, {
      address: message.address,
      message: siweMessage.prepareMessage(),
      signature,
    });

    if (!result) throw new Error("signature validation error");

    return NextResponse.json({ ok: true, address: message.address });
  } catch (err: any) {
    console.error("[SIWE LOGIN ERROR]", err);
    return NextResponse.json(
      { error: "Invalid SIWE message or signature" },
      { status: 400 },
    );
  }
}
