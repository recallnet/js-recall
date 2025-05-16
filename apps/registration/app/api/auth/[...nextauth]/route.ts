import { AuthOptions } from "next-auth";
import { Session } from "next-auth";
import { JWT } from "next-auth/jwt";
import NextAuth from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import { getCsrfToken } from "next-auth/react";
import { SiweMessage } from "siwe";

interface SessionToken extends JWT {
  sub: string; // wallet address
  teamId?: string;
  isAdmin?: boolean;
}

interface UserSession extends Session {
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
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
