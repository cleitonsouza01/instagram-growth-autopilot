import { describe, it, expect } from "vitest";
import { detectResponseError } from "../../api/response-detector";
import {
  RateLimitError,
  ActionBlockError,
  NotAuthenticatedError,
  CheckpointRequiredError,
  InstagramApiError,
} from "../../api/errors";

describe("detectResponseError", () => {
  it("does not throw for successful responses", () => {
    expect(() =>
      detectResponseError({ body: { status: "ok" }, status: 200 }),
    ).not.toThrow();
  });

  it("throws RateLimitError for 429", () => {
    expect(() =>
      detectResponseError({ body: {}, status: 429 }),
    ).toThrow(RateLimitError);
  });

  it("throws ActionBlockError for spam response", () => {
    expect(() =>
      detectResponseError({ body: { spam: true }, status: 400 }),
    ).toThrow(ActionBlockError);
  });

  it("throws ActionBlockError for feedback_required", () => {
    expect(() =>
      detectResponseError({
        body: { message: "feedback_required" },
        status: 400,
      }),
    ).toThrow(ActionBlockError);
  });

  it("throws CheckpointRequiredError with URL", () => {
    try {
      detectResponseError({
        body: {
          message: "checkpoint_required",
          checkpoint_url: "https://www.instagram.com/challenge/123/",
        },
        status: 400,
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CheckpointRequiredError);
      expect((err as CheckpointRequiredError).checkpointUrl).toBe(
        "https://www.instagram.com/challenge/123/",
      );
    }
  });

  it("throws NotAuthenticatedError for login_required", () => {
    expect(() =>
      detectResponseError({
        body: { message: "login_required" },
        status: 403,
      }),
    ).toThrow(NotAuthenticatedError);
  });

  it("throws InstagramApiError for generic 400 with fail status", () => {
    expect(() =>
      detectResponseError({
        body: { status: "fail", message: "Something went wrong" },
        status: 400,
      }),
    ).toThrow(InstagramApiError);
  });

  it("throws InstagramApiError for non-JSON error responses", () => {
    expect(() =>
      detectResponseError({ body: null, status: 500 }),
    ).toThrow(InstagramApiError);
  });
});
