export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

export class RateLimitError extends InstagramApiError {
  constructor(response?: unknown) {
    super("Rate limit exceeded", 429, response);
    this.name = "RateLimitError";
  }
}

export class ActionBlockError extends InstagramApiError {
  constructor(response?: unknown) {
    super("Action blocked by Instagram", 400, response);
    this.name = "ActionBlockError";
  }
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated — no valid Instagram session found");
    this.name = "NotAuthenticatedError";
  }
}

export class CheckpointRequiredError extends InstagramApiError {
  constructor(
    public readonly checkpointUrl: string,
    response?: unknown,
  ) {
    super("Checkpoint required", 400, response);
    this.name = "CheckpointRequiredError";
  }
}
