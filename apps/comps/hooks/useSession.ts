import { useContext } from "react";

import { toast } from "@recallnet/ui2/components/toast";

import { useCookieConsentState } from "@/components/cookie-consent-provider";
import { SessionContext } from "@/providers/session-provider";

export const useSession = () => {
  const context = useContext(SessionContext);
  const { showCookieConsent } = useCookieConsentState();

  if (!context) {
    const showConsentRequired = function () {
      // When user tries to login without consent, show the cookie consent banner
      toast.error("Cookie consent required", {
        description:
          "Please accept functional cookies to sign in and access your account",
      });
      showCookieConsent();
    };

    // Return default unauthenticated state when no provider is available (no consent yet)
    return {
      isAuthenticated: false,
      isWalletConnected: false,
      ready: true,
      isPending: false,
      backendUser: null,
      user: null,
      login: () => {
        showConsentRequired();
      },
      logout: () => {
        showConsentRequired();
      },
      updateBackendUser: async () => {
        showConsentRequired();
      },
      linkWallet: async () => {
        showConsentRequired();
        return null;
      },
      linkOrConnectWallet: () => {
        showConsentRequired();
      },
      linkOrConnectWalletError: null,
      loginError: null,
      error: null,
      refetchBackendUser: async () => {
        showConsentRequired();
        return {} as any;
      },
      isFetchBackendUserLoading: false,
      isFetchBackendUserError: false,
      fetchBackendUserError: null,
      isLoginPending: false,
      isLoginToBackendPending: false,
      isLoginToBackendError: false,
      loginToBackendError: null,
      isUpdateBackendUserPending: false,
      isUpdateBackendUserError: false,
      updateBackendUserError: null,
      isLinkWalletToBackendPending: false,
      isLinkWalletToBackendError: false,
      linkWalletToBackendError: null,
      isError: false,
    };
  }
  return context;
};
