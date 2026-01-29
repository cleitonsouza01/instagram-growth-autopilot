import {
  RateLimitError,
  ActionBlockError,
  NotAuthenticatedError,
  CheckpointRequiredError,
  PlatformApiError,
  ContentNotFoundError,
} from "./errors";

interface DetectedResponse {
  body: unknown;
  status: number;
  rawText?: string;
}

/**
 * Classify a platform API response and throw the appropriate error
 * if an error condition is detected.
 */
export function detectResponseError(response: DetectedResponse): void {
  const { body, status } = response;

  // Rate limit
  if (status === 429) {
    throw new RateLimitError(body);
  }

  // Parse body for error patterns
  if (typeof body === "object" && body !== null) {
    const obj = body as Record<string, unknown>;

    // Spam / action block
    if (obj.spam === true || obj.message === "feedback_required") {
      throw new ActionBlockError(body);
    }

    // Checkpoint required
    if (obj.message === "checkpoint_required" && typeof obj.checkpoint_url === "string") {
      throw new CheckpointRequiredError(obj.checkpoint_url, body);
    }

    // Login required (session expired)
    if (obj.message === "login_required") {
      throw new NotAuthenticatedError();
    }

    // Generic failure
    if (status >= 400 && obj.status === "fail") {
      throw new PlatformApiError(
        (typeof obj.message === "string" ? obj.message : "Request failed"),
        status,
        body,
      );
    }
  }

  // Non-JSON error responses
  if (status >= 400) {
    // Check for deleted/unavailable content patterns in raw text
    const rawText = response.rawText ?? "";
    if (
      rawText.includes("photo has been deleted") ||
      rawText.includes("video has been deleted") ||
      rawText.includes("media has been deleted") ||
      rawText.includes("page isn't available") ||
      rawText.includes("content isn't available")
    ) {
      throw new ContentNotFoundError(rawText.slice(0, 100), body);
    }

    throw new PlatformApiError(`HTTP ${status}`, status, body);
  }
}
