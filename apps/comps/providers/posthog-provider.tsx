"use client";

import posthog from "posthog-js";
import type { ConfigDefaults } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { ReactNode, useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

/**
 * PostHog analytics provider that respects user cookie consent.
 * Only initializes when analytics cookies are accepted.
 *
 * This provider listens to vanilla-cookieconsent events (cc:onConsent, cc:onChange, storage)
 * for dynamic initialization/shutdown without page reloads. When consent is granted,
 * PostHog is initialized. When consent is revoked, PostHog is shut down and all tracking
 * data is cleared.
 */
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
    // Check for existing consent using vanilla-cookieconsent format
    const checkConsent = () => {
      try {
        // First try using the CookieConsent library's API, which works with both
        // cookie-based and localStorage-based consent storage
        return CookieConsent.acceptedCategory("analytics");
      } catch {
        // If the library is not ready yet, fall back to parsing localStorage directly
        try {
          const cc = localStorage.getItem("cc"); // vanilla-cookieconsent stores data here
          if (!cc) {
            return false;
          }

          const ccData = JSON.parse(cc);
          return ccData.categories?.includes("analytics") ?? false;
        } catch (error) {
          console.warn("Failed to parse cookie consent data", error);
          return false;
        }
      }
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

    // Listen for custom consent events (same tab changes)
    const handleConsentUpdate = () => {
      handleConsentChange();
    };
    window.addEventListener("cc:onConsent", handleConsentUpdate);
    window.addEventListener("cc:onChange", handleConsentUpdate);

    return () => {
      window.removeEventListener("storage", handleConsentChange);
      window.removeEventListener("cc:onConsent", handleConsentUpdate);
      window.removeEventListener("cc:onChange", handleConsentUpdate);
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
