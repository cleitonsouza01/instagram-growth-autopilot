import { igFetch } from "../client";
import { getEndpoint, resolveUrl } from "../endpoint-registry";
import type { UserProfile } from "../../types/instagram";

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
  const response = await igFetch<WebProfileResponse>(
    endpoint.url,
    endpoint.method,
    {
      params: { username },
      signal,
    },
  );
  return response.data.user;
}

export async function getUserById(
  userId: string,
  signal?: AbortSignal,
): Promise<UserProfile> {
  const endpoint = await getEndpoint("userById");
  const url = resolveUrl(endpoint.url, { userId });
  const response = await igFetch<UserInfoResponse>(url, endpoint.method, {
    signal,
  });
  return response.user;
}

export async function searchUsers(
  query: string,
  signal?: AbortSignal,
): Promise<Array<{ pk: string; username: string; full_name: string }>> {
  const endpoint = await getEndpoint("searchUsers");
  const response = await igFetch<SearchResult>(endpoint.url, endpoint.method, {
    params: { query },
    signal,
  });
  return response.users.map((u) => ({
    pk: u.user.pk,
    username: u.user.username,
    full_name: u.user.full_name,
  }));
}
