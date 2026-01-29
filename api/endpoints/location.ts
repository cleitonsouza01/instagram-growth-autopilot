import { platformFetch } from "../client";
import { getEndpoint } from "../endpoint-registry";

export interface LocationResult {
  pk: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
}

interface LocationSearchResponse {
  venues: Array<{
    external_id: string;
    name: string;
    address: string;
    city: string;
    lat: number;
    lng: number;
  }>;
  status: string;
}

/**
 * Search for locations by query string.
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<LocationResult[]> {
  const endpoint = await getEndpoint("locationSearch");

  const response = await platformFetch<LocationSearchResponse>(
    endpoint.url,
    "GET",
    {
      params: { search_query: query, rank_token: `${Date.now()}` },
      signal,
    },
  );

  return (response.venues ?? []).map((v) => ({
    pk: v.external_id,
    name: v.name,
    address: v.address,
    city: v.city,
    lat: v.lat,
    lng: v.lng,
  }));
}
