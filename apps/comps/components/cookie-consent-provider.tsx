"use client";

import { createContext, useContext, useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

interface CookieConsentContextType {
  consent: boolean | null;
  isLoading: boolean;
}

const CookieConsentContext = createContext<CookieConsentContextType>({
  consent: null,
  isLoading: true,
});

export const useCookieConsentState = () => useContext(CookieConsentContext);

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initCookieConsent = async () => {
      await CookieConsent.run({
        categories: {
          necessary: {
            enabled: true,
            readOnly: true,
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
                  "We use cookies to improve your experience and for analytics. Some cookies are necessary for security and basic site functionality (including Cloudflare protection). By clicking 'Accept all', you consent to our use of analytics cookies.",
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
                      "We use cookies to ensure the basic functionalities of the website and to enhance your online experience. Necessary cookies include security cookies from Cloudflare for bot protection and DDoS mitigation.",
                  },
                  {
                    title: "Necessary cookies",
                    description:
                      "These cookies are essential for the proper functioning of the website. This includes Cloudflare security cookies (__cf_bm, _cfuvid, cf_clearance) that protect against bots and malicious traffic. These cannot be disabled.",
                    linkedCategory: "necessary",
                  },
                  {
                    title: "Analytics cookies",
                    description:
                      "These cookies collect information about how you use the website, which helps us improve our services. This includes PostHog analytics, Google Analytics, and Vercel Analytics. These cookies are only set after you give consent.",
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
          setConsent(analyticsAccepted);

          // Reload page to properly initialize tracking scripts
          if (analyticsAccepted) {
            window.location.reload();
          }
        },
        onChange: () => {
          // User changed their consent preferences
          const analyticsAccepted = CookieConsent.acceptedCategory("analytics");
          const previousConsent = consent;
          setConsent(analyticsAccepted);

          // Reload page if user just enabled analytics
          if (!previousConsent && analyticsAccepted) {
            window.location.reload();
          }
        },
      });

      // Check if consent was previously given
      const analyticsAccepted = CookieConsent.acceptedCategory("analytics");
      setConsent(analyticsAccepted);
      setIsLoading(false);
    };

    initCookieConsent();
  }, []);

  return (
    <CookieConsentContext.Provider value={{ consent, isLoading }}>
      {children}
    </CookieConsentContext.Provider>
  );
}
