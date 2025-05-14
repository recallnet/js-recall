"use client";

import { ReactNode, createContext, useContext, useMemo } from "react";

import { useAuth } from "@/hooks/useAuth";

type AuthContextType = ReturnType<typeof useAuth>;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider component
 *
 * Provides authentication context to the application
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => auth, [auth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use the auth context
 */
export function useAuthContext() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }

  return context;
}
