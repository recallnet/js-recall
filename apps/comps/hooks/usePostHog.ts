"use client";

import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";

/**
 * Custom hook for PostHog event tracking
 * Provides a clean interface for capturing events with proper typing
 */
export function useAnalytics() {
  let posthog;

  try {
    // This will return undefined if PostHog provider is not available
    posthog = usePostHog();
  } catch (error) {
    // PostHog provider not available (no consent yet)
    posthog = undefined;
  }

  const trackEvent = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      if (!posthog) {
        // Silently skip tracking when PostHog is not available (no consent)
        return;
      }

      try {
        posthog.capture(eventName, properties);
      } catch (error) {
        console.error("Failed to track event:", eventName, error);
      }
    },
    [posthog],
  );

  return { trackEvent, isEnabled: !!posthog };
}
