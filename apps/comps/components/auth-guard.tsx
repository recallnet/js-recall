import dynamic from "next/dynamic";
import React from "react";

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  skeleton?: React.ReactNode;
}

// Dynamically import the client component with no SSR to prevent hydration mismatch
const AuthGuardClient = dynamic(
  () =>
    import("./auth-guard-client").then((mod) => ({
      default: mod.AuthGuardClient,
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

/**
 * Hydration-safe AuthGuard wrapper
 * This component uses dynamic import to prevent server-side rendering
 * and avoid hydration mismatches caused by localStorage-based auth state
 */
export const AuthGuard: React.FC<AuthGuardProps> = (props) => {
  return <AuthGuardClient {...props} />;
};
