import { SiweMessage } from "siwe";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const testWallet = privateKeyToAccount(TEST_PRIVATE_KEY);

/**
 * Test wallet address for backward compatibility
 */
export const testWalletAddress = testWallet.address.toLowerCase();

/**
 * Generate a unique test wallet for isolated testing
 * @returns Object with privateKey, address, and account
 */
export function createTestWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    address: account.address,
    account,
  };
}

/**
 * Create a SIWE message for testing with a specific wallet
 * @param domain The domain requesting the signature
 * @param nonce The nonce to use in the message
 * @param walletAddress The wallet address to use in the message
 * @returns Prepared SIWE message string
 */
export async function createSiweMessage(
  domain: string,
  nonce: string,
  walletAddress?: string,
): Promise<string> {
  const address = walletAddress || testWallet.address;

  const message = new SiweMessage({
    domain,
    address,
    statement: "Sign in with Ethereum to the app.",
    uri: `https://${domain}`,
    version: "1",
    chainId: 1,
    nonce,
  });

  return message.prepareMessage();
}

/**
 * Sign a SIWE message using a specific account
 * @param message The SIWE message to sign
 * @param account The account to sign with (defaults to test wallet)
 * @returns Hex signature string
 */
export async function signMessage(
  message: string,
  account?: ReturnType<typeof privateKeyToAccount>,
): Promise<string> {
  const signingAccount = account || testWallet;

  return await signingAccount.signMessage({
    message,
  });
}
