/**
 * Utility functions for mobile device detection and behavior
 */

/**
 * Detects if the current device is a mobile device
 * @returns true if the device is mobile, false otherwise
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/**
 * Detects if the current device is iOS
 * @returns true if the device is iOS, false otherwise
 */
export function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;

  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Detects if the current device is Android
 * @returns true if the device is Android, false otherwise
 */
export function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;

  return /Android/.test(navigator.userAgent);
}
