import { logger } from "../utils/logger";

export interface EndpointEntry {
  url: string;
  method: "GET" | "POST";
  fallbackUrl?: string;
  lastVerified?: number;
  broken?: boolean;
}

const STORAGE_KEY = "endpointRegistry";

export const defaultEndpoints: Record<string, EndpointEntry> = {
  userProfile: {
    url: "/api/v1/users/web_profile_info/",
    method: "GET",
  },
  userById: {
    url: "/api/v1/users/{userId}/info/",
    method: "GET",
  },
  searchUsers: {
    url: "/web/search/topsearch/",
    method: "GET",
  },
  followers: {
    url: "/api/v1/friendships/{userId}/followers/",
    method: "GET",
  },
  following: {
    url: "/api/v1/friendships/{userId}/following/",
    method: "GET",
  },
  friendshipStatus: {
    url: "/api/v1/friendships/show/{userId}/",
    method: "GET",
  },
  userFeed: {
    url: "/api/v1/feed/user/{userId}/",
    method: "GET",
  },
  likeMedia: {
    url: "/api/v1/web/likes/{mediaId}/like/",
    method: "POST",
  },
  unlikeMedia: {
    url: "/api/v1/web/likes/{mediaId}/unlike/",
    method: "POST",
  },
};

/**
 * Get an endpoint URL, checking for runtime overrides in chrome.storage.
 */
export async function getEndpoint(key: string): Promise<EndpointEntry> {
  // Check for runtime override
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const overrides = result[STORAGE_KEY] as
      | Record<string, EndpointEntry>
      | undefined;
    if (overrides?.[key]) {
      return overrides[key];
    }
  } catch {
    // Fallback to defaults (e.g., chrome.storage not available in tests)
  }

  const entry = defaultEndpoints[key];
  if (!entry) {
    throw new Error(`Unknown endpoint key: ${key}`);
  }
  return entry;
}

/**
 * Update an endpoint URL at runtime (persisted to chrome.storage).
 */
export async function updateEndpoint(
  key: string,
  url: string,
): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const overrides = (result[STORAGE_KEY] as Record<string, EndpointEntry>) ?? {};

  overrides[key] = {
    ...(defaultEndpoints[key] ?? { method: "GET" }),
    url,
    lastVerified: Date.now(),
    broken: false,
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: overrides });
  logger.info("endpoint-registry", `Updated endpoint: ${key} → ${url}`);
}

/**
 * Resolve path parameters in an endpoint URL.
 * E.g., "/api/v1/users/{userId}/info/" with { userId: "123" } → "/api/v1/users/123/info/"
 */
export function resolveUrl(
  urlTemplate: string,
  params: Record<string, string>,
): string {
  let resolved = urlTemplate;
  for (const [key, value] of Object.entries(params)) {
    resolved = resolved.replace(`{${key}}`, encodeURIComponent(value));
  }
  return resolved;
}
