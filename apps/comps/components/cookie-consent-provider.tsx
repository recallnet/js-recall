"use client";

import { createContext, useContext, useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

interface CookieConsentContextType {
  analyticsConsent: boolean | null;
  isLoading: boolean;
}

const CookieConsentContext = createContext<CookieConsentContextType>({
  analyticsConsent: null,
  isLoading: true,
});

export const useCookieConsentState = () => useContext(CookieConsentContext);

export function CookieConsentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [analyticsConsent, setAnalyticsConsent] = useState<boolean | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initCookieConsent = async () => {
      // Check if localStorage is available (can be blocked in privacy mode or by enterprise policy)
      let canUseLocalStorage = false;
      try {
        const testKey = "__cc_test__";
        localStorage.setItem(testKey, "test");
        localStorage.removeItem(testKey);
        canUseLocalStorage = true;
      } catch (e) {
        console.warn(
          "localStorage is not available, falling back to cookies for consent storage",
          e,
        );
      }

      try {
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
            // Note: Safari Intelligent Tracking Prevention (ITP) purges localStorage after
            // 7 days of no user interaction with the site. This means Safari users will be
            // re-prompted for consent every 7 days if they don't visit. This is acceptable
            // for most use cases. Switching to useLocalStorage: false would avoid this
            // limitation but introduces cookie domain/secure complexity in development.
            useLocalStorage: canUseLocalStorage,
          },
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
                    "Some cookies are necessary for security and basic site functionality. Analytics cookies help us improve our services. By clicking 'Accept all', you consent to our use of analytics cookies.",
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
                        "We use cookies to ensure the basic functionalities of the website and to enhance your online experience. Necessary cookies include authentication, bot protection, and DDoS mitigation.",
                    },
                    {
                      title: "Necessary cookies",
                      description:
                        "These cookies are essential for the proper functioning of the website, and those that protect against bots and malicious traffic. These cannot be disabled.",
                      linkedCategory: "necessary",
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
            const analyticsAccepted =
              CookieConsent.acceptedCategory("analytics");
            setAnalyticsConsent(analyticsAccepted);
            // No page reload needed - React state update triggers re-renders
            // of Tracking and PostHogProviderWrapper components
          },
          onChange: () => {
            // User changed their consent preferences
            const analyticsAccepted =
              CookieConsent.acceptedCategory("analytics");

            setAnalyticsConsent(analyticsAccepted);
            // No page reload needed - React state update triggers re-renders
            // of Tracking and PostHogProviderWrapper components
          },
        });

        // Check if consent was previously given
        const analyticsAccepted = CookieConsent.acceptedCategory("analytics");
        setAnalyticsConsent(analyticsAccepted);
      } catch (error) {
        console.error("Failed to initialize cookie consent:", error);
        setAnalyticsConsent(false);
      } finally {
        setIsLoading(false);
      }
    };

    initCookieConsent();
  }, []);

  return (
    <CookieConsentContext.Provider value={{ analyticsConsent, isLoading }}>
      {children}
    </CookieConsentContext.Provider>
  );
}
