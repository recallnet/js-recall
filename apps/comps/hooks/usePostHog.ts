"use client";

import { usePostHog } from "posthog-js/react";
import { useCallback } from "react";

/**
 * Custom hook for PostHog event tracking
 * Provides a clean interface for capturing events with proper typing
 */
export function useAnalytics() {
  const posthog = usePostHog();

  const trackEvent = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      if (!posthog) {
        console.warn("PostHog not initialized, event not tracked:", eventName);
        return;
      }

      try {
        posthog.capture(eventName, properties);
        console.log("Event tracked:", eventName, properties);
      } catch (error) {
        console.error("Failed to track event:", eventName, error);
      }
    },
    [posthog],
  );

  return { trackEvent };
}
