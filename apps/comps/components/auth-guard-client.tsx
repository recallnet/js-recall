"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DEFAULT_REDIRECT_URL } from "@/constants";
import { useUserSession } from "@/hooks/useAuth";

interface AuthGuardClientProps {
  children: React.ReactNode;
  redirectTo?: string;
  skeleton?: React.ReactNode;
}

/**
 * Client-only AuthGuard component that uses authentication state
 * This component is hydration-safe and will only render on the client
 */
export const AuthGuardClient: React.FC<AuthGuardClientProps> = ({
  children,
  skeleton = null,
  redirectTo = DEFAULT_REDIRECT_URL,
}) => {
  const { isAuthenticated, isLoading } = useUserSession();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  if (isLoading) {
    return skeleton;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return null;
};
