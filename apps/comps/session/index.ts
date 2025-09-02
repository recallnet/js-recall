import { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
  cookieName: process.env.COOKIE_NAME || "session",
  password:
    process.env.ROOT_ENCRYPTION_KEY ||
    "default_encryption_key_do_not_use_in_production",
  ttl: Number(process.env.SESSION_TTL),
  // See here for available options: https://github.com/jshttp/cookie#options-1
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: Number(process.env.SESSION_TTL),
    domain: "localhost",
  },
};
