import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { createSiweMessage, parseSiweMessage } from "viem/siwe";

import { useLogin, useNonce } from "./useAuth";

/**
 * Custom SIWE authentication hook that integrates ConnectKit with our backend API
 * Manual authentication only - no auto-triggering
 */
export function useSiweAuth() {
    const { address, isConnected, chainId } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const { refetch: refetchNonce } = useNonce();
    const { mutateAsync: login } = useLogin();

    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const authenticate = async () => {
        if (!address || !chainId || !isConnected) {
            throw new Error("Wallet not connected");
        }

        console.log(`🔐 [SIWE] Starting authentication for:`, { address, chainId, isConnected });
        setIsAuthenticating(true);
        setAuthError(null);

        try {
            // Get fresh nonce
            console.log(`🎲 [SIWE] Fetching nonce...`);
            const nonceResult = await refetchNonce();
            const nonce = nonceResult.data?.nonce;
            console.log(`🎲 [SIWE] Nonce received:`, nonce ? 'YES' : 'NO');

            if (!nonce) {
                throw new Error("Failed to get nonce");
            }

            // Create SIWE message
            const message = createSiweMessage({
                domain: document.location.host,
                address,
                statement: "Sign in with Ethereum to the app.",
                uri: document.location.origin,
                version: "1",
                chainId,
                nonce,
            });

            console.log(`✍️ [SIWE] Created message, requesting signature...`);

            // Sign the message
            const signature = await signMessageAsync({ message });
            console.log(`✅ [SIWE] Message signed successfully`);

            // Verify signature with backend
            const siweMessage = parseSiweMessage(message);
            if (!siweMessage.address) {
                throw new Error("No address found in SIWE message");
            }

            console.log(`🔐 [SIWE] Calling login API...`);
            await login({
                message,
                signature,
                wallet: siweMessage.address,
            });

            console.log(`🎉 [SIWE] Authentication completed successfully`);
            // Debug: Check if cookie exists immediately after login
            console.log(`🍪 [SIWE] Cookies immediately after login:`, document.cookie);

            // Wait a moment and check again
            setTimeout(() => {
                console.log(`🍪 [SIWE] Cookies 100ms after login:`, document.cookie);
            }, 100);

            setTimeout(() => {
                console.log(`🍪 [SIWE] Cookies 1000ms after login:`, document.cookie);
            }, 1000);

            setIsAuthenticating(false);
            return true;
        } catch (error) {
            console.error(`❌ [SIWE] Authentication failed:`, error);
            setAuthError(error instanceof Error ? error.message : "Authentication failed");
            setIsAuthenticating(false);
            throw error;
        }
    };

    return {
        authenticate,
        isAuthenticating,
        authError,
        clearError: () => setAuthError(null),
    };
} 