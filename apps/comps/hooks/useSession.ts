import { useContext } from "react";

import { toast } from "@recallnet/ui2/components/toast";

import { useCookieConsentState } from "@/components/cookie-consent-provider";
import { Session, SessionContext } from "@/providers/session-provider";

const createConsentRequiredSession = (
  showConsentRequired: () => void,
): Session => {
  const noOp = () => {
    showConsentRequired();
  };
  const noOpAsync = async () => {
    showConsentRequired();
  };

  return {
    isAuthenticated: false,
    isWalletConnected: false,
    ready: true,
    isPending: false,
    backendUser: undefined,
    user: null,
    loginError: null,
    error: null,
    linkOrConnectWalletError: null,
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

    // Methods that all need to trigger the cookie consent modal
    login: noOp,
    logout: noOpAsync,
    updateBackendUser: noOpAsync as unknown as Session["updateBackendUser"],
    linkOrConnectWallet: noOp,
    refetchBackendUser: noOpAsync as unknown as Session["refetchBackendUser"],
  };
};

export const useSession = (): Session => {
  const context = useContext(SessionContext);
  const { showCookieConsent } = useCookieConsentState();

  if (!context) {
    const showConsentRequired = () => {
      // When user tries to login without consent, show the cookie consent banner
      toast.error("Cookie consent required", {
        description:
          "Please accept functional cookies to sign in and access your account",
      });
      showCookieConsent();
    };

    // Return default unauthenticated state when no provider is available (no consent yet)
    return createConsentRequiredSession(showConsentRequired);
  }
  return context;
};
