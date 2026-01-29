export class PlatformApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = "PlatformApiError";
  }
}

export class RateLimitError extends PlatformApiError {
  constructor(response?: unknown) {
    super("Rate limit exceeded", 429, response);
    this.name = "RateLimitError";
  }
}

export class ActionBlockError extends PlatformApiError {
  constructor(response?: unknown) {
    super("Action blocked by platform", 400, response);
    this.name = "ActionBlockError";
  }
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated - no valid platform session found");
    this.name = "NotAuthenticatedError";
  }
}

export class CheckpointRequiredError extends PlatformApiError {
  constructor(
    public readonly checkpointUrl: string,
    response?: unknown,
  ) {
    super("Checkpoint required", 400, response);
    this.name = "CheckpointRequiredError";
  }
}

/**
 * Thrown when trying to interact with deleted/unavailable content.
 * This is a non-fatal error - we should skip this item and continue.
 */
export class ContentNotFoundError extends PlatformApiError {
  constructor(message: string, response?: unknown) {
    super(message, 404, response);
    this.name = "ContentNotFoundError";
  }
}
