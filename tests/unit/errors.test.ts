import { describe, it, expect } from "vitest";
import {
  PlatformApiError,
  RateLimitError,
  ActionBlockError,
  NotAuthenticatedError,
  CheckpointRequiredError,
} from "../../api/errors";

describe("PlatformApiError", () => {
  it("stores status code and response", () => {
    const err = new PlatformApiError("test error", 400, { foo: "bar" });
    expect(err.message).toBe("test error");
    expect(err.statusCode).toBe(400);
    expect(err.response).toEqual({ foo: "bar" });
    expect(err.name).toBe("PlatformApiError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("RateLimitError", () => {
  it("has status 429", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe("RateLimitError");
    expect(err).toBeInstanceOf(PlatformApiError);
  });
});

describe("ActionBlockError", () => {
  it("has status 400", () => {
    const err = new ActionBlockError({ spam: true });
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("ActionBlockError");
    expect(err.response).toEqual({ spam: true });
  });
});

describe("NotAuthenticatedError", () => {
  it("has descriptive message", () => {
    const err = new NotAuthenticatedError();
    expect(err.message).toContain("Not authenticated");
    expect(err.name).toBe("NotAuthenticatedError");
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(PlatformApiError);
  });
});

describe("CheckpointRequiredError", () => {
  it("stores checkpoint URL", () => {
    const err = new CheckpointRequiredError(
      "https://www.platform.com/challenge/",
      { checkpoint_url: "..." },
    );
    expect(err.checkpointUrl).toBe("https://www.platform.com/challenge/");
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe("CheckpointRequiredError");
  });
});
