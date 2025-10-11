"use client";

import posthog from "posthog-js";
import type { ConfigDefaults } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { ReactNode, useEffect, useState } from "react";

interface PostHogProviderWrapperProps {
  children: ReactNode;
}

// Track whether PostHog has been initialized
let isInitialized = false;

function initializePostHog() {
  if (isInitialized) return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (posthogKey && posthogHost) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      defaults: "2025-05-24" as ConfigDefaults,
      // Enable tracking since we only init after consent
      opt_out_capturing_by_default: false,
      // Enable automatic capture
      autocapture: true,
      capture_pageview: true,
      // Respect Do Not Track
      respect_dnt: true,
    });
    isInitialized = true;

    // Capture initial pageview
    posthog.capture("$pageview");
  }
}

function shutdownPostHog() {
  if (!isInitialized) return;

  // Clear all PostHog data and cookies
  posthog.reset();
  posthog.opt_out_capturing();

  // Remove PostHog cookies
  document.cookie.split(";").forEach((c) => {
    const cookie = c.trim();
    if (cookie.startsWith("ph_")) {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
    }
  });

  isInitialized = false;
}

export function PostHogProviderWrapper({
  children,
}: PostHogProviderWrapperProps) {
  const [hasConsent, setHasConsent] = useState(false);
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  useEffect(() => {
    // Check for existing consent
    const checkConsent = () => {
      const cookieConsent = localStorage.getItem("cookie-consent");
      const cc = localStorage.getItem("cc"); // vanilla-cookieconsent stores data here

      let consentGiven = false;

      // Check our simple consent first
      if (cookieConsent === "true") {
        consentGiven = true;
      }

      // Check vanilla-cookieconsent format
      if (cc) {
        try {
          const ccData = JSON.parse(cc);
          if (ccData.categories?.includes("analytics")) {
            consentGiven = true;
          }
        } catch {
          // Invalid JSON, ignore
        }
      }

      return consentGiven;
    };

    // Handle consent state changes
    const handleConsentChange = () => {
      const consentGiven = checkConsent();
      setHasConsent(consentGiven);

      if (consentGiven && !isInitialized) {
        // User gave consent, initialize PostHog
        initializePostHog();
      } else if (!consentGiven && isInitialized) {
        // User revoked consent, shutdown PostHog
        shutdownPostHog();
      }
    };

    // Check on mount
    handleConsentChange();

    // Listen for storage changes (consent from another tab)
    window.addEventListener("storage", handleConsentChange);

    // Listen for custom consent events
    const handleConsentUpdate = () => {
      handleConsentChange();
    };
    window.addEventListener("cc:onConsent", handleConsentUpdate);
    window.addEventListener("cc:onChange", handleConsentUpdate);

    // Also check periodically in case consent changed in same tab
    const interval = setInterval(handleConsentChange, 1000);

    return () => {
      window.removeEventListener("storage", handleConsentChange);
      window.removeEventListener("cc:onConsent", handleConsentUpdate);
      window.removeEventListener("cc:onChange", handleConsentUpdate);
      clearInterval(interval);
    };
  }, []);

  if (!posthogKey || !posthogHost) {
    console.warn("PostHog configuration missing. Analytics will be disabled.");
    return <>{children}</>;
  }

  // Only provide PostHog context if initialized and has consent
  if (hasConsent && isInitialized) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
  }

  // Return children without PostHog provider when no consent
  return <>{children}</>;
}
