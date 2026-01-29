import { getCsrfToken } from "./csrf";
import { detectResponseError } from "./response-detector";
import { withRetry, type RetryConfig } from "./retry";
import { logger } from "../utils/logger";
import { getSettings } from "../storage/chrome-storage";

// Cached base URL (refreshed on each request batch)
let cachedBaseUrl: string | null = null;

/**
 * Get the platform base URL from settings.
 * Caches the value to avoid repeated storage reads.
 */
export async function getPlatformBaseUrl(): Promise<string> {
  if (!cachedBaseUrl) {
    const settings = await getSettings();
    cachedBaseUrl = settings.platformBaseUrl;
  }
  return cachedBaseUrl;
}

/**
 * Clear the cached base URL (call when settings change).
 */
export function clearBaseUrlCache(): void {
  cachedBaseUrl = null;
}

/**
 * Build the required headers for Instagram API requests.
 * Called from the content script on instagram.com (same-origin).
 * User-Agent, Referer, and cookies are handled automatically by the browser.
 */
function buildHeaders(csrfToken: string, method: "GET" | "POST"): HeadersInit {
  const headers: HeadersInit = {
    "X-CSRFToken": csrfToken,
    "X-IG-App-ID": "936619743392459", // Instagram web app ID
    "X-Instagram-AJAX": "1", // Required for mutation requests
    "X-ASBD-ID": "129544", // Required header
    "X-Requested-With": "XMLHttpRequest",
    Accept: "*/*",
  };

  // Only add Content-Type for POST with body
  if (method === "POST") {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  return headers;
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
 * Same-origin fetch wrapper for platform API endpoints.
 * Runs inside the content script on the platform.
 *
 * - Automatically includes CSRF token
 * - Retries with exponential backoff
 * - Detects and classifies error responses
 */
export async function platformFetch<T = unknown>(
  path: string,
  method: "GET" | "POST" = "GET",
  options: RequestOptions = {},
): Promise<T> {
  const csrfToken = getCsrfToken();
  const headers = buildHeaders(csrfToken, method);
  const baseUrl = await getPlatformBaseUrl();

  let url = `${baseUrl}${path}`;

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

  // Add body for POST requests (Instagram requires body even if empty)
  if (method === "POST") {
    // Always send a body for POST requests - Instagram requires it
    const bodyStr = options.body
      ? new URLSearchParams(options.body).toString()
      : "";
    fetchOptions.body = bodyStr;
  }

  return withRetry(async () => {
    logger.debug("client", `API request: ${method} ${url}`, {
      hasBody: method === "POST",
      bodyLength: method === "POST" ? (fetchOptions.body as string).length : 0,
      csrfTokenPresent: !!csrfToken,
    });

    const response = await fetch(url, fetchOptions);

    // Log immediately after fetch completes - BEFORE anything else
    logger.debug("client", `Fetch completed: ${method} ${response.status}`, {
      url: url.slice(0, 100),
      ok: response.ok,
    });

    let body: unknown;
    let rawText: string | null = null;

    try {
      // Clone response to read text if json parsing fails
      rawText = await response.clone().text();
      body = rawText ? JSON.parse(rawText) : null;
    } catch {
      body = null;
    }

    // Log response details - more verbose for non-200 responses
    if (response.ok) {
      logger.debug("client", `API response: ${response.status}`, { url });
    } else {
      logger.warn("client", `API error response: ${response.status}`, {
        url,
        body: body ? JSON.stringify(body).slice(0, 500) : null,
        rawText: rawText?.slice(0, 200) ?? "(empty)",
        contentType: response.headers.get("content-type"),
      });
    }

    // Check for error conditions (pass rawText for deleted content detection)
    detectResponseError({ body, status: response.status, rawText: rawText ?? undefined });

    return body as T;
  }, options.retry);
}
