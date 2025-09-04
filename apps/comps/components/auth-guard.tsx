import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { DEFAULT_REDIRECT_URL } from "@/constants";
import { useUserSession } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
  skeleton?: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  skeleton = null,
  redirectTo = DEFAULT_REDIRECT_URL,
}) => {
  const session = useUserSession();
  const router = useRouter();
  const lastWasAuthedRef = useRef(false);

  // Track last authenticated state to avoid tearing down UI during transient loading
  useEffect(() => {
    if (session.isInitialized) {
      lastWasAuthedRef.current = session.isAuthenticated;
    }
  }, [session]);

  useEffect(() => {
    if (!session.isInitialized) {
      return;
    }

    if (!session.isLoading && !session.isAuthenticated) {
      router.push(redirectTo);
    }
  }, [session, router, redirectTo]);

  if (!session.isInitialized) {
    return skeleton;
  }

  // While loading, keep previous authed content mounted to avoid flicker
  if (session.isLoading) {
    return lastWasAuthedRef.current ? <>{children}</> : skeleton;
  }

  if (session.isAuthenticated) {
    return <>{children}</>;
  }

  // When unauthenticated, show skeleton while redirecting to avoid a blank frame
  return skeleton;
};
