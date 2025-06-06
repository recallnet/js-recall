"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * A hook to handle redirection based on a query parameter.
 * It reads a `redirectTo` query parameter from the URL and provides a `redirect` function.
 * If `redirectTo` is present, it redirects to that URL. Otherwise, it redirects to a fallback URL.
 *
 * @param fallbackUrl The URL to redirect to if the `redirectTo` query parameter is not present.
 * @returns An object containing the `redirect` function and the resolved `redirectToUrl`.
 */
export const useRedirectTo = (fallbackUrl: string) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectToUrl = useMemo(() => {
    return searchParams.get("redirectTo") || fallbackUrl;
  }, [searchParams, fallbackUrl]);

  const redirect = useCallback(() => {
    router.push(redirectToUrl);
  }, [router, redirectToUrl]);

  return { redirect, redirectToUrl };
};
