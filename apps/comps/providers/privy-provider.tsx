"use client";

import { PrivyClientConfig, PrivyProvider } from "@privy-io/react-auth";
import { ReactNode, useEffect } from "react";

import { NEXT_PUBLIC_FRONTEND_URL } from "@/config";

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
  // Login methods configuration
  loginMethods: ["email", "google"],

  // Appearance configuration
  appearance: {
    theme: themeBackground, // Use dark theme as base since your CSS uses dark colors
    accentColor: themeForeground,
    logo: `${NEXT_PUBLIC_FRONTEND_URL}/logo_white_full.svg`,
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

  // Apply custom CSS variables to Privy modal elements
  useEffect(() => {
    setCSSVariable("--privy-color-background", themeBackground);
    setCSSVariable("--privy-color-foreground", themeForeground);
  }, []);

  if (!privyAppId) {
    console.error("NEXT_PUBLIC_PRIVY_APP_ID is not configured");
    return <div>Authentication configuration error</div>;
  }

  return (
    <PrivyProvider appId={privyAppId} config={privyConfig}>
      {children}
    </PrivyProvider>
  );
}
