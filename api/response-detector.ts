import {
  RateLimitError,
  ActionBlockError,
  NotAuthenticatedError,
  CheckpointRequiredError,
  InstagramApiError,
} from "./errors";

interface DetectedResponse {
  body: unknown;
  status: number;
}

/**
 * Classify an Instagram API response and throw the appropriate error
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
      throw new InstagramApiError(
        (typeof obj.message === "string" ? obj.message : "Request failed"),
        status,
        body,
      );
    }
  }

  // Non-JSON error responses
  if (status >= 400) {
    throw new InstagramApiError(`HTTP ${status}`, status, body);
  }
}
