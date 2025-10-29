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
          name: "cc",
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
                      "Functional cookies enable features like staying logged in across sessions and remembering your preferences. You can still use authentication and wallet features without accepting these cookies.",
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
            window.location.reload();
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
            if (!previousConsent && newConsent) {
              window.location.reload();
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
