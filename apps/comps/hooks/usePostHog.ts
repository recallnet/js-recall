"use client";

import { usePostHog } from "posthog-js/react";

/**
 * Custom hook for PostHog event tracking
 * Provides a clean interface for capturing events with proper typing
 */
export function useAnalytics() {
  const posthog = usePostHog();

  const trackEvent = (eventName: string, properties?: Record<string, any>) => {
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
  };

  return { trackEvent };
}
