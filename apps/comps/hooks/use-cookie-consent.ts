"use client";

import { useEffect, useState } from "react";

const CONSENT_KEY = "cookie-consent";

export function useCookieConsent() {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if consent has been given before
    const storedConsent = localStorage.getItem(CONSENT_KEY);
    if (storedConsent !== null) {
      setConsent(storedConsent === "true");
    }
    setIsLoading(false);
  }, []);

  const acceptCookies = () => {
    localStorage.setItem(CONSENT_KEY, "true");
    setConsent(true);
    // Reload the page to properly initialize tracking scripts
    window.location.reload();
  };

  const rejectCookies = () => {
    localStorage.setItem(CONSENT_KEY, "false");
    setConsent(false);
  };

  return {
    consent,
    isLoading,
    acceptCookies,
    rejectCookies,
    hasConsented: consent !== null,
  };
}
