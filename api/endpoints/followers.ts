import { igFetch } from "../client";
import { getEndpoint, resolveUrl } from "../endpoint-registry";
import type { FollowerInfo, PaginatedResponse, FriendshipStatus } from "../../types/instagram";

interface FollowersApiResponse {
  users: FollowerInfo[];
  next_max_id?: string;
  status: string;
}

interface FriendshipApiResponse extends FriendshipStatus {
  status: string;
}

export async function getFollowers(
  userId: string,
  cursor?: string,
  count = 50,
  signal?: AbortSignal,
): Promise<PaginatedResponse<FollowerInfo>> {
  const endpoint = await getEndpoint("followers");
  const url = resolveUrl(endpoint.url, { userId });

  const params: Record<string, string> = { count: String(count) };
  if (cursor) {
    params.max_id = cursor;
  }

  const response = await igFetch<FollowersApiResponse>(
    url,
    endpoint.method,
    { params, signal },
  );

  return {
    items: response.users,
    next_max_id: response.next_max_id ?? null,
    has_more: !!response.next_max_id,
  };
}

export async function getFollowing(
  userId: string,
  cursor?: string,
  count = 50,
  signal?: AbortSignal,
): Promise<PaginatedResponse<FollowerInfo>> {
  const endpoint = await getEndpoint("following");
  const url = resolveUrl(endpoint.url, { userId });

  const params: Record<string, string> = { count: String(count) };
  if (cursor) {
    params.max_id = cursor;
  }

  const response = await igFetch<FollowersApiResponse>(
    url,
    endpoint.method,
    { params, signal },
  );

  return {
    items: response.users,
    next_max_id: response.next_max_id ?? null,
    has_more: !!response.next_max_id,
  };
}

export async function getFriendshipStatus(
  userId: string,
  signal?: AbortSignal,
): Promise<FriendshipStatus> {
  const endpoint = await getEndpoint("friendshipStatus");
  const url = resolveUrl(endpoint.url, { userId });

  const response = await igFetch<FriendshipApiResponse>(
    url,
    endpoint.method,
    { signal },
  );

  return {
    following: response.following,
    followed_by: response.followed_by,
    blocking: response.blocking,
    is_private: response.is_private,
    incoming_request: response.incoming_request,
    outgoing_request: response.outgoing_request,
  };
}
