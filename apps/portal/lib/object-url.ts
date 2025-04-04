import { Address } from "viem";

/**
 * Constructs a properly encoded URL for an object
 * Ensures path segments are correctly encoded while preserving the / structure
 *
 * @param baseUrl The base API URL (e.g., from getObjectApiUrl)
 * @param bucketAddress The bucket address
 * @param path The object path
 * @returns A properly formatted URL string
 */
export function constructObjectUrl(
  baseUrl: string,
  bucketAddress: string | Address,
  path: string
): string {
  // Encode each path segment separately to preserve the / structure
  const encodedPath = path.split("/").map(segment => encodeURIComponent(segment)).join("/");
  return `${baseUrl}/v1/objects/${bucketAddress}/${encodedPath}`;
}