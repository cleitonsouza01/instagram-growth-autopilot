import { getCsrfToken } from "./csrf";
import { detectResponseError } from "./response-detector";
import { withRetry, type RetryConfig } from "./retry";
import { logger } from "../utils/logger";

/**
 * Build the required headers for Instagram API requests.
 * Called from the content script on instagram.com (same-origin).
 * User-Agent, Referer, and cookies are handled automatically by the browser.
 */
function buildHeaders(csrfToken: string): HeadersInit {
  return {
    "X-CSRFToken": csrfToken,
    "X-Instagram-AJAX": "1",
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

export interface RequestOptions {
  /** Query parameters appended to the URL */
  params?: Record<string, string>;
  /** POST body (form-encoded) */
  body?: Record<string, string>;
  /** Custom retry config */
  retry?: Partial<RetryConfig>;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Same-origin fetch wrapper for Instagram API endpoints.
 * Runs inside the content script on instagram.com.
 *
 * - Automatically includes CSRF token
 * - Retries with exponential backoff
 * - Detects and classifies error responses
 */
export async function igFetch<T = unknown>(
  path: string,
  method: "GET" | "POST" = "GET",
  options: RequestOptions = {},
): Promise<T> {
  const csrfToken = getCsrfToken();
  const headers = buildHeaders(csrfToken);

  let url = `https://www.instagram.com${path}`;

  // Append query parameters for GET requests
  if (options.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: "same-origin",
    signal: options.signal,
  };

  // Add body for POST requests
  if (method === "POST" && options.body) {
    fetchOptions.body = new URLSearchParams(options.body).toString();
  }

  return withRetry(async () => {
    logger.debug("client", `${method} ${path}`);

    const response = await fetch(url, fetchOptions);
    let body: unknown;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    // Check for error conditions
    detectResponseError({ body, status: response.status });

    return body as T;
  }, options.retry);
}
