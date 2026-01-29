import { NotAuthenticatedError } from "./errors";

// Cached CSRF token (set by content script, used by background)
let cachedCsrfToken: string | null = null;

/**
 * Extract the CSRF token from document.cookie.
 * This cookie is NOT HttpOnly, so it's readable in the content script.
 * The HttpOnly `sessionid` cookie is handled automatically by the browser
 * for same-origin fetch() calls.
 */
export function getCsrfToken(): string {
  // If we have a cached token (set from content script), use it
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  // Try to extract from document.cookie (only works in content script)
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    if (match?.[1]) {
      cachedCsrfToken = match[1];
      return cachedCsrfToken;
    }
  }

  throw new NotAuthenticatedError();
}

/**
 * Set the CSRF token (called from content script to share with background).
 */
export function setCsrfToken(token: string): void {
  cachedCsrfToken = token;
}

/**
 * Get the cached CSRF token without throwing.
 */
export function getCachedCsrfToken(): string | null {
  return cachedCsrfToken;
}

/**
 * Check if the user has an active platform session.
 * We check for the csrftoken cookie as a proxy - if it exists,
 * the user is logged in and the HttpOnly sessionid is also present.
 */
export function isLoggedIn(): boolean {
  if (cachedCsrfToken) return true;
  if (typeof document !== "undefined") {
    return /csrftoken=.+/.test(document.cookie);
  }
  return false;
}

/**
 * Extract CSRF token from document (content script only).
 */
export function extractCsrfFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match?.[1] ?? null;
}
