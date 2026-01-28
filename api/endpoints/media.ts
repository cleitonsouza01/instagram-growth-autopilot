import { igFetch } from "../client";
import { getEndpoint, resolveUrl } from "../endpoint-registry";
import type { MediaItem, PaginatedResponse, LikeResponse } from "../../types/instagram";

interface FeedApiResponse {
  items: MediaItem[];
  next_max_id?: string;
  more_available?: boolean;
  status: string;
}

export async function getUserFeed(
  userId: string,
  count = 12,
  signal?: AbortSignal,
): Promise<PaginatedResponse<MediaItem>> {
  const endpoint = await getEndpoint("userFeed");
  const url = resolveUrl(endpoint.url, { userId });

  const response = await igFetch<FeedApiResponse>(url, endpoint.method, {
    params: { count: String(count) },
    signal,
  });

  return {
    items: response.items,
    next_max_id: response.next_max_id ?? null,
    has_more: response.more_available ?? false,
  };
}

export async function likeMedia(
  mediaId: string,
  signal?: AbortSignal,
): Promise<LikeResponse> {
  const endpoint = await getEndpoint("likeMedia");
  const url = resolveUrl(endpoint.url, { mediaId });

  return igFetch<LikeResponse>(url, endpoint.method, { signal });
}

export async function unlikeMedia(
  mediaId: string,
  signal?: AbortSignal,
): Promise<LikeResponse> {
  const endpoint = await getEndpoint("unlikeMedia");
  const url = resolveUrl(endpoint.url, { mediaId });

  return igFetch<LikeResponse>(url, endpoint.method, { signal });
}
