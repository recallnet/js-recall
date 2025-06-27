"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { useUserSession } from "@/hooks/useAuth";
import { isMobileDevice } from "@/lib/mobile-utils";

/**
 * Component that provides mobile-specific signing guidance
 */
export function MobileSignHelper() {
  const { isConnected } = useAccount();
  const userSession = useUserSession();
  const [showMobileHelp, setShowMobileHelp] = useState(false);

  useEffect(() => {
    // Only show on mobile when user is connected but not authenticated
    const isAuthenticating =
      isConnected && userSession.isInitialized && !userSession.isAuthenticated;

    if (isMobileDevice() && isAuthenticating) {
      setShowMobileHelp(true);

      // Hide after 15 seconds or when auth completes
      const timer = setTimeout(() => {
        setShowMobileHelp(false);
      }, 15000);

      return () => clearTimeout(timer);
    } else {
      setShowMobileHelp(false);
    }
  }, [isConnected, userSession]);

  const handleRetrySign = () => {
    // Trigger the RainbowKit authentication modal again
    // This is safer than auto-triggering signMessage
    window.location.reload();
  };

  if (!showMobileHelp) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg bg-blue-600 p-4 text-white shadow-lg">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium">Signing Message</h3>
          <p className="mt-1 text-xs">
            If your wallet app doesn&apos;t open automatically, please return to
            it manually to complete signing.
          </p>
          <button
            onClick={handleRetrySign}
            className="mt-2 rounded bg-blue-700 px-3 py-1 text-xs font-medium text-white hover:bg-blue-800"
          >
            Retry Signing
          </button>
        </div>
        <button
          onClick={() => setShowMobileHelp(false)}
          className="flex-shrink-0 text-white hover:text-gray-200"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
