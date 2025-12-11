"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "recall-onboarding-complete";

/**
 * Synchronously checks if onboarding has been completed by reading from localStorage.
 * Use this in callbacks where the hook state may not be up-to-date due to closure capture.
 * @returns true if onboarding is complete, false otherwise
 */
export function checkOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    // localStorage may not be available (SSR, private browsing, etc.)
    return false;
  }
}

/**
 * Hook to track and persist onboarding completion status in localStorage.
 * @returns Object containing completion status and a function to mark onboarding as complete
 */
export function useOnboardingComplete(): {
  isComplete: boolean;
  isLoading: boolean;
  markComplete: () => void;
} {
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setIsComplete(stored === "true");
    } catch {
      // localStorage may not be available (SSR, private browsing, etc.)
      setIsComplete(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markComplete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
      setIsComplete(true);
    } catch {
      // Silently fail if localStorage is not available
      setIsComplete(true);
    }
  }, []);

  return { isComplete, isLoading, markComplete };
}
