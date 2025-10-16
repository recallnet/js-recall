"use client";

import { createContext, useContext, useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

interface CookieConsentContextType {
  consent: boolean | null;
  isLoading: boolean;
  showCookieConsent: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType>({
  consent: null,
  isLoading: true,
  showCookieConsent: () => {},
});

export const useCookieConsentState = () => useContext(CookieConsentContext);

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Function to show the cookie consent banner when user tries to sign in without consent
  const showCookieConsent = () => {
    // Check if functional cookies are already accepted
    try {
      const functionalAccepted = CookieConsent.acceptedCategory("functional");

      if (functionalAccepted) {
        // Already accepted, no need to show banner
        setConsent(true);
        return;
      }
    } catch {
      // CookieConsent might not be initialized yet
      console.log("CookieConsent not ready");
    }

    // Show the consent modal so user can accept cookies
    CookieConsent.show(true);
  };

  useEffect(() => {
    const initCookieConsent = async () => {
      await CookieConsent.run({
        cookie: {
          name: "cc_cookie",
          // Automatically use current domain
          domain: window.location.hostname,
          path: "/",
          sameSite: "Lax",
          // Set secure only on HTTPS to ensure cookies work in all environments
          secure: window.location.protocol === "https:",
          expiresAfterDays: 365,
          // Use localStorage as primary storage to avoid cookie domain/secure issues
          useLocalStorage: true,
        },
        categories: {
          necessary: {
            enabled: true,
            readOnly: true,
          },
          functional: {
            enabled: false,
          },
          analytics: {
            enabled: false,
          },
        },
        language: {
          default: "en",
          translations: {
            en: {
              consentModal: {
                title: "We use cookies",
                description:
                  "We use cookies to improve your experience. Some cookies are necessary for security and basic site functionality. Functional cookies enable authentication features. By clicking 'Accept all', you consent to our use of all cookies.",
                acceptAllBtn: "Accept all",
                acceptNecessaryBtn: "Reject all",
                showPreferencesBtn: "Manage preferences",
              },
              preferencesModal: {
                title: "Cookie preferences",
                acceptAllBtn: "Accept all",
                acceptNecessaryBtn: "Reject all",
                savePreferencesBtn: "Save preferences",
                closeIconLabel: "Close",
                sections: [
                  {
                    title: "Cookie usage",
                    description:
                      "We use cookies to ensure the basic functionalities of the website and to enhance your online experience. Necessary cookies include ones used for bot protection and DDoS mitigation.",
                  },
                  {
                    title: "Necessary cookies",
                    description:
                      "These cookies are essential for the proper functioning of the website, and those that protect against bots and malicious traffic. These cannot be disabled.",
                    linkedCategory: "necessary",
                  },
                  {
                    title: "Functional cookies",
                    description:
                      "These cookies enable essential features like user authentication and session management through Privy. <b>Without these cookies, you cannot log in</b> or access authenticated features.",
                    linkedCategory: "functional",
                  },
                  {
                    title: "Analytics cookies",
                    description:
                      "These cookies collect information about how you use the website, which helps us improve our services.",
                    linkedCategory: "analytics",
                  },
                ],
              },
            },
          },
        },
        guiOptions: {
          consentModal: {
            layout: "bar",
            position: "bottom center",
            equalWeightButtons: false,
            flipButtons: false,
          },
          preferencesModal: {
            layout: "box",
            position: "right",
            equalWeightButtons: false,
            flipButtons: false,
          },
        },
        onFirstConsent: () => {
          // User just gave consent for the first time
          const analyticsAccepted = CookieConsent.acceptedCategory("analytics");
          const functionalAccepted =
            CookieConsent.acceptedCategory("functional");
          setConsent(analyticsAccepted || functionalAccepted);

          // Reload page to properly initialize tracking scripts and auth
          if (analyticsAccepted || functionalAccepted) {
            // Check if we've already reloaded to prevent infinite loop
            const hasReloadedKey = "cc_has_reloaded";
            const hasReloaded = sessionStorage.getItem(hasReloadedKey);

            if (!hasReloaded) {
              // Set flag before reload to prevent loop
              sessionStorage.setItem(hasReloadedKey, "true");

              // Small delay to ensure consent is persisted before reload
              setTimeout(() => {
                window.location.reload();
              }, 100);
            }
          }
        },
        onChange: () => {
          // User changed their consent preferences
          const analyticsAccepted = CookieConsent.acceptedCategory("analytics");
          const functionalAccepted =
            CookieConsent.acceptedCategory("functional");

          setConsent((previousConsent) => {
            const newConsent = analyticsAccepted || functionalAccepted;

            // Reload page if user just enabled analytics or functional cookies
            // and this isn't triggered by the initial consent (which is handled by onFirstConsent)
            if (!previousConsent && newConsent && previousConsent !== null) {
              // Check if we've already reloaded to prevent infinite loop
              const hasReloadedKey = "cc_has_reloaded";
              const hasReloaded = sessionStorage.getItem(hasReloadedKey);

              if (!hasReloaded) {
                // Set flag before reload to prevent loop
                sessionStorage.setItem(hasReloadedKey, "true");

                // Small delay to ensure consent is persisted before reload
                setTimeout(() => {
                  window.location.reload();
                }, 100);
              }
            }

            return newConsent;
          });
        },
      });

      // Check if consent was previously given
      const analyticsAccepted = CookieConsent.acceptedCategory("analytics");
      const functionalAccepted = CookieConsent.acceptedCategory("functional");
      setConsent(analyticsAccepted || functionalAccepted);
      setIsLoading(false);

      // Clear the reload flag after successful initialization
      // This allows future consent changes to trigger reloads again if needed
      sessionStorage.removeItem("cc_has_reloaded");
    };

    initCookieConsent();
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{ consent, isLoading, showCookieConsent }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}
