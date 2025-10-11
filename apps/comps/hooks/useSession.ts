import { useContext } from "react";

import { useCookieConsentState } from "@/components/cookie-consent-provider";
import { SessionContext } from "@/providers/session-provider";

export const useSession = () => {
  const context = useContext(SessionContext);
  const { showCookieConsent } = useCookieConsentState();

  if (!context) {
    // Return default unauthenticated state when no provider is available (no consent yet)
    return {
      isAuthenticated: false,
      ready: true,
      isPending: false,
      backendUser: null,
      user: null,
      login: () => {
        // When user tries to login without consent, show the cookie consent banner
        showCookieConsent();
      },
      logout: () => {
        console.warn("Authentication not available - consent required");
      },
      updateBackendUser: async () => {
        console.warn("Authentication not available - consent required");
      },
      linkWallet: async () => {
        console.warn("Authentication not available - consent required");
        return null;
      },
      loginError: null,
      error: null,
    };
  }
  return context;
};
