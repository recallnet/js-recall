import {NextRequest, NextResponse} from 'next/server';
import {SiweMessage} from 'siwe';
import {verifyMessage} from '@wagmi/core';
import {config} from "@/wagmi-config";

export async function POST(req: NextRequest) {
  try {
    const {message, signature} = await req.json();

    if (!message || !signature) {
      return NextResponse.json({error: 'Missing message or signature'}, {status: 400});
    }

    const siweMessage = new SiweMessage(message);
    const result = await verifyMessage(config, {address: message.address, message: siweMessage.prepareMessage(), signature})

    if (!result)
      throw new Error("signature validation error")

    return NextResponse.json({ok: true, address: message.address});
  } catch (err: any) {
    console.error('[SIWE LOGIN ERROR]', err);
    return NextResponse.json({error: 'Invalid SIWE message or signature'}, {status: 400});
  }
}

