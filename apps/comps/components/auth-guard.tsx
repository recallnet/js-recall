import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

  useEffect(() => {
    if (!session.isInitialized) {
      return;
    }

    if (!session.isLoading && !session.isAuthenticated) {
      router.push(redirectTo);
    }
  }, [session, router, redirectTo]);

  if (!session.isInitialized || session.isLoading) {
    return skeleton;
  }

  if (session.isAuthenticated) {
    return <>{children}</>;
  }

  return null;
};
