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

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      setIsComplete(stored === "true");
    } catch {
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
      setIsComplete(true);
    }
  }, []);

  return { isComplete, isLoading, markComplete };
}
