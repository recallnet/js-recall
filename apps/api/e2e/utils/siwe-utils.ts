import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const testWallet = privateKeyToAccount(TEST_PRIVATE_KEY);

/**
 * Create a SIWE message for testing
 * @param domain The domain requesting the signature
 * @param nonce The nonce to use in the message
 * @returns Prepared SIWE message string
 */
export async function createSiweMessage(
  domain: string,
  nonce: string,
): Promise<string> {
  const message = new SiweMessage({
    domain,
    address: testWallet.address,
    statement: "Sign in with Ethereum to the app.",
    uri: `https://${domain}`,
    version: "1",
    chainId: 1,
    nonce,
  });

  return message.prepareMessage();
}

/**
 * Sign a message with the test wallet
 * @param message The message to sign
 * @returns The signature
 */
export async function signMessage(message: string): Promise<string> {
  return testWallet.signMessage({ message });
}

/**
 * The Ethereum address of the test wallet
 */
export const testWalletAddress = testWallet.address.toLowerCase();
