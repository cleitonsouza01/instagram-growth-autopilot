import { NotAuthenticatedError } from "./errors";

/**
 * Extract the CSRF token from document.cookie.
 * This cookie is NOT HttpOnly, so it's readable in the content script.
 * The HttpOnly `sessionid` cookie is handled automatically by the browser
 * for same-origin fetch() calls.
 */
export function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  if (!match?.[1]) {
    throw new NotAuthenticatedError();
  }
  return match[1];
}

/**
 * Check if the user has an active Instagram session.
 * We check for the csrftoken cookie as a proxy — if it exists,
 * the user is logged in and the HttpOnly sessionid is also present.
 */
export function isLoggedIn(): boolean {
  return /csrftoken=.+/.test(document.cookie);
}
