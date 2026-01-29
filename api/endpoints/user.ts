import { platformFetch } from "../client";
import { getEndpoint, resolveUrl } from "../endpoint-registry";
import type { UserProfile } from "../../types/platform";
import { logger } from "../../utils/logger";

interface WebProfileResponse {
  data: {
    user: UserProfile;
  };
  status: string;
}

interface UserInfoResponse {
  user: UserProfile;
  status: string;
}

interface SearchResult {
  users: Array<{
    user: {
      pk: string;
      username: string;
      full_name: string;
      profile_pic_url: string;
      is_private: boolean;
      is_verified: boolean;
    };
  }>;
}

export async function getUserByUsername(
  username: string,
  signal?: AbortSignal,
): Promise<UserProfile> {
  const endpoint = await getEndpoint("userProfile");
  const response = await platformFetch<WebProfileResponse>(
    endpoint.url,
    endpoint.method,
    {
      params: { username },
      signal,
    },
  );

  logger.debug("user-api", `Raw response for ${username}`, {
    hasData: !!response?.data,
    hasUser: !!response?.data?.user,
    userId: response?.data?.user?.pk ?? response?.data?.user?.id ?? "missing",
    responseKeys: response ? Object.keys(response) : [],
  });

  const user = response.data.user;

  // Instagram sometimes uses 'id' instead of 'pk'
  if (!user.pk && (user as unknown as { id: string }).id) {
    user.pk = (user as unknown as { id: string }).id;
  }

  return user;
}

export async function getUserById(
  userId: string,
  signal?: AbortSignal,
): Promise<UserProfile> {
  const endpoint = await getEndpoint("userById");
  const url = resolveUrl(endpoint.url, { userId });
  const response = await platformFetch<UserInfoResponse>(url, endpoint.method, {
    signal,
  });

  // Log the actual response structure to diagnose issues
  logger.debug("user-api", `getUserById response for ${userId}`, {
    hasUser: !!response?.user,
    mediaCount: response?.user?.media_count,
    followerCount: response?.user?.follower_count,
    responseKeys: response ? Object.keys(response) : [],
    userKeys: response?.user ? Object.keys(response.user) : [],
  });

  return response.user;
}

export async function searchUsers(
  query: string,
  signal?: AbortSignal,
): Promise<Array<{ pk: string; username: string; full_name: string }>> {
  const endpoint = await getEndpoint("searchUsers");
  const response = await platformFetch<SearchResult>(endpoint.url, endpoint.method, {
    params: { query },
    signal,
  });
  return response.users.map((u) => ({
    pk: u.user.pk,
    username: u.user.username,
    full_name: u.user.full_name,
  }));
}
