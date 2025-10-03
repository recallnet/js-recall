"use client";

import { PrivyClientConfig, PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { NavigationGuardProvider } from "next-navigation-guard";
import { ReactNode, useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";

import { chainWithRpcUrl } from "@/config/chain";
import { SessionProvider } from "@/providers/session-provider";
import { clientConfig } from "@/wagmi-config";

const themeBackground = "#15191f";
const themeForeground = "#ffffff";

function setCSSVariable(variable: string, value: string) {
  if (typeof window !== "undefined") {
    document.documentElement.style.setProperty(variable, value);
  }
}

/**
 * Configuration for the Privy provider.
 */
const privyConfig: PrivyClientConfig = {
  // Chain configuration
  defaultChain: chainWithRpcUrl,
  supportedChains: [chainWithRpcUrl],

  // Login methods configuration
  loginMethods: ["email", "google"],

  // Appearance configuration
  appearance: {
    theme: themeBackground, // Use dark theme as base since your CSS uses dark colors
    accentColor: themeForeground,
    logo: "https://5pskttgrmgbdllus.public.blob.vercel-storage.com/logo_white.png",
    showWalletLoginFirst: false, // Show social login options first
    walletList: [
      "metamask",
      "base_account",
      "coinbase_wallet",
      "okx_wallet",
      "binance",
      "detected_ethereum_wallets",
      "phantom",
      "rabby_wallet",
      "rainbow",
      "safe",
      "wallet_connect",
      "wallet_connect_qr",
      "zerion",
    ],
  },

  // Embedded wallet configuration
  embeddedWallets: {
    ethereum: {
      createOnLogin: "all-users", // Create embedded wallet for all users
    },
  },

  // Legal links
  legal: {
    termsAndConditionsUrl: "https://recall.network/terms",
    privacyPolicyUrl: "https://recall.network/privacy",
  },

  // Additional features
  mfa: {
    noPromptOnMfaRequired: false, // Prompt for MFA when required
  },
};

/**
 * Privy configuration wrapper
 * Replaces WalletConnect/ConnectKit for authentication
 */
export function PrivyProviderWrapper({ children }: { children: ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const [hasFunctionalConsent, setHasFunctionalConsent] = useState(false);
  const [isCheckingConsent, setIsCheckingConsent] = useState(true);

  // Check for functional cookie consent
  useEffect(() => {
    const checkFunctionalConsent = () => {
      const functionalAccepted = CookieConsent.acceptedCategory("functional");
      setHasFunctionalConsent(functionalAccepted);
      setIsCheckingConsent(false);
    };

    // Initial check
    checkFunctionalConsent();

    // Listen for consent changes
    const handleConsentChange = () => {
      checkFunctionalConsent();
    };

    window.addEventListener("cc:onConsent", handleConsentChange);
    window.addEventListener("cc:onChange", handleConsentChange);

    return () => {
      window.removeEventListener("cc:onConsent", handleConsentChange);
      window.removeEventListener("cc:onChange", handleConsentChange);
    };
  }, []);

  // Apply custom CSS variables to Privy modal elements
  useEffect(() => {
    setCSSVariable("--privy-color-background", themeBackground);
    setCSSVariable("--privy-color-foreground", themeForeground);
  }, []);

  if (!privyAppId) {
    console.error("NEXT_PUBLIC_PRIVY_APP_ID is not configured");
    return <div>Authentication configuration error</div>;
  }

  // Don't initialize Privy until we know consent status
  if (isCheckingConsent) {
    return <>{children}</>;
  }

  // Only initialize Privy if user has given consent for functional cookies
  // Privy sets functional cookies that require consent under GDPR
  if (!hasFunctionalConsent) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      <WagmiProvider config={clientConfig}>
        <SessionProvider>
          <NavigationGuardProvider>{children}</NavigationGuardProvider>
        </SessionProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
