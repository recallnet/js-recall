"use client";

import { useCookieConsent } from "@/hooks/use-cookie-consent";

export function CookieConsent() {
  const { isLoading, acceptCookies, rejectCookies, hasConsented } =
    useCookieConsent();

  // Don't show banner if loading, consent already given, or explicitly rejected
  if (isLoading || hasConsented) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-gray-900 p-4">
      <div className="mx-auto flex max-w-screen-lg flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-gray-300">
          We use cookies to improve your experience and for analytics. By
          clicking &ldquo;Accept&rdquo;, you consent to our use of cookies.
        </p>
        <div className="flex gap-2">
          <button
            onClick={rejectCookies}
            className="px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white"
          >
            Reject
          </button>
          <button
            onClick={acceptCookies}
            className="rounded bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
