import { platformFetch } from "../client";
import { getEndpoint, resolveUrl } from "../endpoint-registry";
import type { FollowerInfo, PaginatedResponse, FriendshipStatus } from "../../types/platform";
import { logger } from "../../utils/logger";

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

  const response = await platformFetch<FollowersApiResponse>(
    url,
    endpoint.method,
    { params, signal },
  );

  logger.debug("followers-api", `Response for user ${userId}`, {
    usersCount: response.users?.length ?? 0,
    hasNextMaxId: !!response.next_max_id,
    status: response.status,
    responseKeys: response ? Object.keys(response) : [],
  });

  // Instagram sometimes returns empty or undefined users array
  const users = response.users ?? [];

  return {
    items: users,
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

  const response = await platformFetch<FollowersApiResponse>(
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

  const response = await platformFetch<FriendshipApiResponse>(
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

interface FollowActionResponse {
  friendship_status: FriendshipStatus;
  status: string;
}

/**
 * Follow a user by their user ID.
 */
export async function followUser(
  userId: string,
  signal?: AbortSignal,
): Promise<FriendshipStatus> {
  const endpoint = await getEndpoint("followUser");
  const url = resolveUrl(endpoint.url, { userId });

  logger.info("followers-api", `Following user ${userId}`);

  const response = await platformFetch<FollowActionResponse>(
    url,
    endpoint.method,
    { signal },
  );

  logger.debug("followers-api", `Follow response for ${userId}`, {
    status: response.status,
    following: response.friendship_status?.following,
  });

  return response.friendship_status;
}

/**
 * Unfollow a user by their user ID.
 */
export async function unfollowUser(
  userId: string,
  signal?: AbortSignal,
): Promise<FriendshipStatus> {
  const endpoint = await getEndpoint("unfollowUser");
  const url = resolveUrl(endpoint.url, { userId });

  logger.info("followers-api", `Unfollowing user ${userId}`);

  const response = await platformFetch<FollowActionResponse>(
    url,
    endpoint.method,
    { signal },
  );

  return response.friendship_status;
}
