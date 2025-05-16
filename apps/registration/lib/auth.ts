/**
 * Auth utilities for working with Ethereum authentication
 */
import { AuthOptions } from "next-auth";
import { Session } from "next-auth";
import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { getCsrfToken } from "next-auth/react";
import { SiweMessage } from "siwe";

export interface SessionToken extends JWT {
  sub: string; // wallet address
  teamId?: string;
  isAdmin?: boolean;
}

export interface UserSession extends Session {
  address: string;
  user: {
    name: string;
    address: string;
    teamId: string | null;
    isAdmin: boolean;
  };
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Ethereum",
      credentials: {
        message: {
          label: "Message",
          placeholder: "0x0",
          type: "text",
        },
        signature: {
          label: "Signature",
          placeholder: "0x0",
          type: "text",
        },
      },
      async authorize(credentials, req) {
        console.log("credentials", credentials);
        try {
          const siwe = new SiweMessage(credentials?.message || "");

          const nextAuthUrl =
            process.env.NEXTAUTH_URL ||
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : null);
          if (!nextAuthUrl) {
            return null;
          }

          const nextAuthHost = new URL(nextAuthUrl).host;
          if (siwe.domain !== nextAuthHost) {
            return null;
          }

          if (
            siwe.nonce !==
            (await getCsrfToken({ req: { headers: req.headers } }))
          ) {
            return null;
          }

          await siwe.verify({ signature: credentials?.signature || "" });
          console.log("test");
          return {
            id: siwe.address,
            address: siwe.address,
            teamId: null,
            isAdmin: false,
          };
        } catch (e) {
          console.error("SIWE verification error:", e);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt" },

  debug: process.env.NODE_ENV === "development",

  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.address = user.address;
        token.teamId = user.teamId;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      const userSession = session as UserSession;
      const sessionToken = token as SessionToken;

      userSession.address = sessionToken.sub;
      userSession.user = {
        name: sessionToken.sub,
        address: sessionToken.sub,
        teamId: sessionToken.teamId ?? null,
        isAdmin: sessionToken.isAdmin ?? false,
      };

      return userSession;
    },
  },
  pages: {
    signIn: "/login",
  },
};

/**
 * Create a Sign-In with Ethereum (SIWE) message
 *
 * @param address The wallet address signing the message
 * @param nonce The nonce to include in the message
 * @param domain The domain for which the signature is being created
 * @returns A formatted message for the user to sign
 */
export function createSiweMessage(
  address: string,
  nonce: string,
  domain: string = window.location.host,
): string {
  // Format the message for the user to sign
  const message = `Sign in to ${domain} with your Ethereum account:
${address}

I accept the Terms of Service of this site.

Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;

  return message;
}

/**
 * Helper function to get the authentication status from the server
 *
 * @returns The current authentication status and user data
 */
export async function getAuthStatus() {
  try {
    const response = await fetch("/api/auth/session");
    const data = await response.json();

    return {
      isAuthenticated: data.authenticated || false,
      wallet: data.wallet || null,
      teamId: data.teamId || null,
      isAdmin: data.isAdmin || false,
    };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return {
      isAuthenticated: false,
      wallet: null,
      teamId: null,
      isAdmin: false,
    };
  }
}

/**
 * Logout the current user
 *
 * @returns Whether the logout was successful
 */
export async function logout() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error("Error logging out:", error);
    return false;
  }
}

/**
 * Get a new nonce for authentication
 *
 * @returns The generated nonce or null if there was an error
 */
export async function getNonce() {
  try {
    const response = await fetch("/api/generate-nonce");
    const data = await response.json();

    if (data.success && data.nonce) {
      return data.nonce;
    }

    return null;
  } catch (error) {
    console.error("Error getting nonce:", error);
    return null;
  }
}

/**
 * Authenticate with a wallet signature
 *
 * @param wallet The wallet address
 * @param signature The signature of the message
 * @param message The message that was signed
 * @returns Whether the authentication was successful
 */
export async function authenticateWithSignature(
  wallet: string,
  signature: string,
  message: string,
) {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wallet,
        signature,
        message,
      }),
    });

    const data = await response.json();
    return {
      success: data.success || false,
      wallet: data.wallet || null,
      teamId: data.teamId || null,
      error: data.error || null,
    };
  } catch (error) {
    console.error("Error authenticating:", error);
    return {
      success: false,
      wallet: null,
      teamId: null,
      error: error instanceof Error ? error.message : "Failed to authenticate",
    };
  }
}
