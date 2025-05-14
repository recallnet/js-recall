/**
 * Auth utilities for working with Ethereum authentication
 */

/**
 * Create a Sign-In with Ethereum (SIWE) message
 *
 * @param address The wallet address signing the message
 * @param nonce The nonce to include in the message
 * @param domain The domain for which the signature is being created
 * @returns A formatted message for the user to sign
 */
export function createSiweMessage(
  address: string,
  nonce: string,
  domain: string = window.location.host,
): string {
  // Format the message for the user to sign
  const message = `Sign in to ${domain} with your Ethereum account:
${address}

I accept the Terms of Service of this site.

Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;

  return message;
}

/**
 * Helper function to get the authentication status from the server
 *
 * @returns The current authentication status and user data
 */
export async function getAuthStatus() {
  try {
    const response = await fetch("/api/auth/session");
    const data = await response.json();

    return {
      isAuthenticated: data.authenticated || false,
      wallet: data.wallet || null,
      teamId: data.teamId || null,
      isAdmin: data.isAdmin || false,
    };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return {
      isAuthenticated: false,
      wallet: null,
      teamId: null,
      isAdmin: false,
    };
  }
}

/**
 * Logout the current user
 *
 * @returns Whether the logout was successful
 */
export async function logout() {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error("Error logging out:", error);
    return false;
  }
}

/**
 * Get a new nonce for authentication
 *
 * @returns The generated nonce or null if there was an error
 */
export async function getNonce() {
  try {
    const response = await fetch("/api/generate-nonce");
    const data = await response.json();

    if (data.success && data.nonce) {
      return data.nonce;
    }

    return null;
  } catch (error) {
    console.error("Error getting nonce:", error);
    return null;
  }
}

/**
 * Authenticate with a wallet signature
 *
 * @param wallet The wallet address
 * @param signature The signature of the message
 * @param message The message that was signed
 * @returns Whether the authentication was successful
 */
export async function authenticateWithSignature(
  wallet: string,
  signature: string,
  message: string,
) {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wallet,
        signature,
        message,
      }),
    });

    const data = await response.json();
    return {
      success: data.success || false,
      wallet: data.wallet || null,
      teamId: data.teamId || null,
      error: data.error || null,
    };
  } catch (error) {
    console.error("Error authenticating:", error);
    return {
      success: false,
      wallet: null,
      teamId: null,
      error: error instanceof Error ? error.message : "Failed to authenticate",
    };
  }
}
