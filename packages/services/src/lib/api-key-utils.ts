import * as crypto from "crypto";

/**
 * Shared utilities for API key operations
 */

/**
 * Generate SHA256 hash for an API key
 * Used for fast database lookups without storing plain text keys
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Decrypt an encrypted API key
 * @param encryptedKey - The encrypted key in format "iv:encrypted"
 * @param rootEncryptionKey - The root encryption key
 */
export function decryptApiKey(
  encryptedKey: string,
  rootEncryptionKey: string,
): string {
  const algorithm = "aes-256-cbc";
  const parts = encryptedKey.split(":");

  if (parts.length !== 2) {
    throw new Error("Invalid encrypted key format");
  }

  const iv = Buffer.from(parts[0]!, "hex");
  const encrypted = parts[1]!;

  // Create a consistently-sized key from the root encryption key
  const cryptoKey = crypto
    .createHash("sha256")
    .update(rootEncryptionKey)
    .digest();

  const decipher = crypto.createDecipheriv(algorithm, cryptoKey, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
