import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../api/retry";
import {
  InstagramApiError,
  ActionBlockError,
  NotAuthenticatedError,
  RateLimitError,
} from "../../api/errors";

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError())
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on server error", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new InstagramApiError("Server error", 500))
      .mockRejectedValueOnce(new InstagramApiError("Server error", 502))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new InstagramApiError("Server error", 500));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow("Server error");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry ActionBlockError", async () => {
    const fn = vi.fn().mockRejectedValue(new ActionBlockError());

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow(ActionBlockError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry NotAuthenticatedError", async () => {
    const fn = vi.fn().mockRejectedValue(new NotAuthenticatedError());

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow(NotAuthenticatedError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retryable status codes", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new InstagramApiError("Bad request", 400));

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow("Bad request");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
