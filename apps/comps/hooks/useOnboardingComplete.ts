"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useCallback } from "react";

const STORAGE_KEY = "recall-onboarding-complete";

export const onboardingCompleteAtom = atomWithStorage(STORAGE_KEY, false);

/**
 * Hook to track and persist onboarding completion status in localStorage.
 * @returns Object containing completion status and a function to mark onboarding as complete
 */
export function useOnboardingComplete() {
  const isComplete = useAtomValue(onboardingCompleteAtom);
  const setComplete = useSetAtom(onboardingCompleteAtom);

  const markComplete = useCallback(() => {
    setComplete(true);
  }, [setComplete]);

  return { isComplete, markComplete };
}
