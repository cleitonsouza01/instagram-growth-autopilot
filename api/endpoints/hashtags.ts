import { platformFetch } from "../client";
import { getEndpoint } from "../endpoint-registry";

export interface HashtagResult {
  name: string;
  mediaCount: number;
  id: string;
}

interface HashtagSearchResponse {
  hashtags: Array<{
    name: string;
    media_count: number;
    id: string;
  }>;
  status: string;
}

/**
 * Search for hashtags by query string.
 */
export async function searchHashtags(
  query: string,
  signal?: AbortSignal,
): Promise<HashtagResult[]> {
  const endpoint = await getEndpoint("hashtagSearch");

  const response = await platformFetch<HashtagSearchResponse>(
    endpoint.url,
    "GET",
    {
      params: { q: query, search_surface: "hashtag_search_page" },
      signal,
    },
  );

  return (response.hashtags ?? []).map((h) => ({
    name: h.name,
    mediaCount: h.media_count,
    id: h.id,
  }));
}

/**
 * Get info about a specific hashtag.
 */
export async function getHashtagInfo(
  name: string,
  signal?: AbortSignal,
): Promise<HashtagResult | null> {
  const endpoint = await getEndpoint("hashtagInfo");

  try {
    const response = await platformFetch<{
      name: string;
      media_count: number;
      id: string;
      status: string;
    }>(endpoint.url.replace("{name}", encodeURIComponent(name)), "GET", {
      signal,
    });

    return {
      name: response.name,
      mediaCount: response.media_count,
      id: response.id,
    };
  } catch {
    return null;
  }
}
