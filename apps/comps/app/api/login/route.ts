import {NextRequest, NextResponse} from 'next/server';
import {SiweMessage} from 'siwe';

export async function POST(req: NextRequest) {
  try {
    const {message, signature} = await req.json();

    if (!message || !signature) {
      return NextResponse.json({error: 'Missing message or signature'}, {status: 400});
    }

    const siweMessage = new SiweMessage(message);
    const fields = await siweMessage.verify({
      signature,
      time: siweMessage.issuedAt,
      scheme: siweMessage.scheme,
      domain: siweMessage.domain,
      nonce: siweMessage.nonce,
    });

    if (!fields.success)
      throw new Error(fields.error || "signature validation error")

    return NextResponse.json({ok: fields.success, address: fields.data.address});
  } catch (err: any) {
    console.error('[SIWE LOGIN ERROR]', err);
    return NextResponse.json({error: 'Invalid SIWE message or signature'}, {status: 400});
  }
}

