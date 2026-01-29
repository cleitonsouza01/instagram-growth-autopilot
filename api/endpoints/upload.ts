import { platformFetch } from "../client";
import { getEndpoint } from "../endpoint-registry";
import { logger } from "../../utils/logger";

export interface UploadUrlResponse {
  upload_id: string;
  upload_url: string;
  status: string;
}

export interface ConfigureMediaResponse {
  media: {
    id: string;
    code: string;
    pk: string;
  };
  status: string;
}

export interface StoryConfigureResponse {
  media: {
    id: string;
    pk: string;
  };
  status: string;
}

/**
 * Request an upload URL for a photo post.
 */
export async function requestPhotoUploadUrl(
  signal?: AbortSignal,
): Promise<UploadUrlResponse> {
  const endpoint = await getEndpoint("uploadPhoto");
  const uploadId = `${Date.now()}`;

  logger.debug("upload", `Requesting photo upload URL (id: ${uploadId})`);

  return platformFetch<UploadUrlResponse>(endpoint.url, "POST", {
    body: {
      upload_id: uploadId,
      media_type: "1", // Photo
    },
    signal,
  });
}

/**
 * Upload photo binary data to the platform.
 * This performs the raw upload to the provided URL.
 */
export async function uploadPhotoData(
  uploadUrl: string,
  imageBlob: Blob,
  uploadId: string,
  signal?: AbortSignal,
): Promise<{ status: string }> {
  logger.debug("upload", `Uploading photo data (${imageBlob.size} bytes)`);

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "image/jpeg",
      "X-Entity-Length": String(imageBlob.size),
      "X-Entity-Name": `fb_uploader_${uploadId}`,
    },
    body: imageBlob,
    credentials: "same-origin",
    signal,
  });

  return response.json() as Promise<{ status: string }>;
}

/**
 * Configure and publish an uploaded photo as a post.
 */
export async function configurePhotoPost(
  uploadId: string,
  caption: string,
  options: {
    locationId?: string;
    userTags?: Array<{ userId: string; x: number; y: number }>;
  } = {},
  signal?: AbortSignal,
): Promise<ConfigureMediaResponse> {
  const endpoint = await getEndpoint("configurePost");
  logger.debug("upload", `Configuring photo post (upload: ${uploadId})`);

  const body: Record<string, string> = {
    upload_id: uploadId,
    caption,
    source_type: "library",
  };

  if (options.locationId) {
    body["location"] = JSON.stringify({
      pk: options.locationId,
      name: "",
    });
  }

  if (options.userTags && options.userTags.length > 0) {
    body["usertags"] = JSON.stringify({
      in: options.userTags.map((t) => ({
        user_id: t.userId,
        position: [t.x, t.y],
      })),
    });
  }

  return platformFetch<ConfigureMediaResponse>(endpoint.url, "POST", {
    body,
    signal,
  });
}

/**
 * Configure and publish an uploaded photo as a story.
 */
export async function configureStory(
  uploadId: string,
  signal?: AbortSignal,
): Promise<StoryConfigureResponse> {
  const endpoint = await getEndpoint("configureStory");
  logger.debug("upload", `Configuring story (upload: ${uploadId})`);

  return platformFetch<StoryConfigureResponse>(endpoint.url, "POST", {
    body: {
      upload_id: uploadId,
      source_type: "library",
    },
    signal,
  });
}

/**
 * Upload and configure a carousel (multi-image) post.
 */
export async function configureCarousel(
  uploadIds: string[],
  caption: string,
  locationId?: string,
  signal?: AbortSignal,
): Promise<ConfigureMediaResponse> {
  const endpoint = await getEndpoint("configureCarousel");
  logger.debug(
    "upload",
    `Configuring carousel (${uploadIds.length} images)`,
  );

  const children = uploadIds.map((id) => ({
    upload_id: id,
    source_type: "library",
  }));

  const body: Record<string, string> = {
    caption,
    children_metadata: JSON.stringify(children),
    client_sidecar_id: `${Date.now()}`,
  };

  if (locationId) {
    body["location"] = JSON.stringify({ pk: locationId, name: "" });
  }

  return platformFetch<ConfigureMediaResponse>(endpoint.url, "POST", {
    body,
    signal,
  });
}
