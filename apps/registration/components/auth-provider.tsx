"use client";

/**
 * @deprecated This component is now removed.
 * We're using NextAuth + RainbowKit SIWE directly with the session from useSession.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * @deprecated Use useAuthState from @/hooks/auth-state or NextAuth's useSession directly
 */
export function useAuthContext() {
  throw new Error(
    "useAuthContext is deprecated. Please use useAuthState from @/hooks/auth-state or NextAuth's useSession directly",
  );
}
