/**
 * Centralized sandbox configuration and utilities
 */

/**
 * Sandbox configuration interface
 */
export interface SandboxConfig {
  sandboxApiUrl: string;
  sandboxAdminApiKey: string;
  apiBaseUrl: string;
}

/**
 * Validates and returns sandbox configuration from environment variables
 * @throws Error if required configuration is missing
 */
export function getSandboxConfig(): SandboxConfig {
  const sandboxApiUrl = process.env.NEXT_PUBLIC_SANDBOX_API_URL;
  const sandboxAdminApiKey = process.env.SANDBOX_ADMIN_API_KEY;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!sandboxApiUrl || !sandboxAdminApiKey || !apiBaseUrl) {
    throw new Error(
      "Sandbox configuration missing. Required environment variables: NEXT_PUBLIC_SANDBOX_API_URL, SANDBOX_ADMIN_API_KEY, NEXT_PUBLIC_API_BASE_URL",
    );
  }

  return {
    sandboxApiUrl,
    sandboxAdminApiKey,
    apiBaseUrl,
  };
}

/**
 * Creates headers for sandbox admin API requests
 */
export function createSandboxAdminHeaders(): Record<string, string> {
  const config = getSandboxConfig();
  return {
    Authorization: `Bearer ${config.sandboxAdminApiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Creates headers for main API requests with session cookie
 */
export function createMainApiHeaders(
  sessionCookie: string,
): Record<string, string> {
  return {
    Cookie: sessionCookie,
    "Content-Type": "application/json",
  };
}

/**
 * Extracts session cookie from request headers
 * @throws Error if no session cookie is found
 */
export function extractSessionCookie(request: Request): string {
  const sessionCookie = request.headers.get("cookie");
  if (!sessionCookie) {
    throw new Error("No session cookie found");
  }
  return sessionCookie;
}

/**
 * Validates API response and returns parsed JSON
 * @throws Error if response is not ok or invalid
 */
export async function validateApiResponse<T>(
  response: Response,
  errorMessage: string,
): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorText =
      errorData?.error || errorData?.message || (await response.text());
    console.error(`${errorMessage}:`, errorText);
    throw new Error(errorText || errorMessage);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(
      data.error || data.message || `Invalid response: ${errorMessage}`,
    );
  }

  return data;
}

/**
 * Makes a request to the sandbox admin API
 */
export async function sandboxAdminRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const config = getSandboxConfig();
  const url = `${config.sandboxApiUrl}${endpoint}`;

  const response = await fetch(url, {
    headers: createSandboxAdminHeaders(),
    ...options,
  });

  return validateApiResponse<T>(
    response,
    `Sandbox admin API request failed: ${endpoint}`,
  );
}

/**
 * Makes a request to the main API with session authentication
 */
export async function mainApiRequest<T>(
  endpoint: string,
  sessionCookie: string,
  options: RequestInit = {},
): Promise<T> {
  const config = getSandboxConfig();
  const url = `${config.apiBaseUrl}${endpoint}`;

  const response = await fetch(url, {
    headers: createMainApiHeaders(sessionCookie),
    ...options,
  });

  return validateApiResponse<T>(
    response,
    `Main API request failed: ${endpoint}`,
  );
}
