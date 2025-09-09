import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { DEFAULT_REDIRECT_URL } from "@/constants";
import { useSession } from "@/hooks/useSession";

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
  const { ready, isAuthenticated, isPending } = useSession();
  const router = useRouter();
  const lastWasAuthedRef = useRef(false);

  // Track last authenticated state to avoid tearing down UI during transient loading
  useEffect(() => {
    if (ready) {
      lastWasAuthedRef.current = isAuthenticated;
    }
  }, [ready, isAuthenticated]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!isPending && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [ready, isPending, isAuthenticated, router, redirectTo]);

  if (!ready) {
    return skeleton;
  }

  // While loading, keep previous authed content mounted to avoid flicker
  if (isPending) {
    return lastWasAuthedRef.current ? <>{children}</> : skeleton;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  // When unauthenticated, show skeleton while redirecting to avoid a blank frame
  return skeleton;
};
