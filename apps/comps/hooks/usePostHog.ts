"use client";

import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";

/**
 * Custom hook for PostHog event tracking
 * Provides a clean interface for capturing events with proper typing
 */
export function useAnalytics() {
  // Call hook unconditionally at the top level
  // This will return undefined if PostHog provider is not available
  const posthog = usePostHog();

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
