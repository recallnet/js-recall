import { IronSession } from "iron-session";
import { SiweMessage, generateNonce } from "siwe";

import { findByWalletAddress } from "@/database/repositories/team-repository.js";
import { LoginResponse, SessionData } from "@/types/index.js";

export class AuthService {
  async getNonce(): Promise<string> {
    const nonce = generateNonce();
    // TODO: we can consider Redis or storing in the database (with expiration)
    return nonce;
  }

  async login(params: {
    message: string;
    signature: string;
    session: IronSession<SessionData>;
  }): Promise<LoginResponse> {
    const { message, signature, session } = params;

    try {
      const siweMessage = new SiweMessage(message);
      const { data: siweData, success: siweSuccess } = await siweMessage.verify(
        {
          signature,
          nonce: session.nonce,
        },
        { suppressExceptions: true },
      );
      if (!siweSuccess) {
        session.nonce = undefined;
        await session.save();
        return { success: false };
      }
      session.nonce = undefined;

      // Attempt to find the team that matches the verified wallet address & store session data
      let team = await findByWalletAddress(siweData.address);
      const teamId = team?.id;
      const wallet = siweData.address;
      session.siwe = siweData;
      // TODO: the frontend wants to use `userId`, but auth flow currently uses `teamId`
      session.teamId = teamId;
      session.wallet = wallet;
      await session.save();

      return { success: true, teamId, wallet };
    } catch (error) {
      console.error(
        "[AuthService] Error during SIWE verification process:",
        error,
      );
      session.nonce = undefined;
      session.siwe = undefined;
      session.teamId = undefined;
      session.wallet = undefined;
      await session.save();
      return { success: false };
    }
  }

  async logout(session: IronSession<SessionData>): Promise<void> {
    session.nonce = undefined;
    session.siwe = undefined;
    session.teamId = undefined;
    session.wallet = undefined;
    await session.save();
    session.destroy();
  }
}
