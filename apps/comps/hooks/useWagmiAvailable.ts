"use client";

import { useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

/**
 * Hook to check if WagmiProvider is available
 * Returns true only when functional cookies are accepted
 */
export function useWagmiAvailable() {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    // Check initial consent state
    const checkConsent = () => {
      const functionalAccepted = CookieConsent.acceptedCategory("functional");
      setIsAvailable(functionalAccepted);
    };

    // Initial check
    checkConsent();

    // Listen for consent changes
    const handleConsentChange = () => {
      checkConsent();
    };

    window.addEventListener("cc:onConsent", handleConsentChange);
    window.addEventListener("cc:onChange", handleConsentChange);

    return () => {
      window.removeEventListener("cc:onConsent", handleConsentChange);
      window.removeEventListener("cc:onChange", handleConsentChange);
    };
  }, []);

  return isAvailable;
}
