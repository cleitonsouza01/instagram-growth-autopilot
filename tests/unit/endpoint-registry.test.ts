import { describe, it, expect } from "vitest";
import { resolveUrl, defaultEndpoints } from "../../api/endpoint-registry";

describe("resolveUrl", () => {
  it("replaces a single parameter", () => {
    const result = resolveUrl("/api/v1/users/{userId}/info/", {
      userId: "12345",
    });
    expect(result).toBe("/api/v1/users/12345/info/");
  });

  it("replaces multiple parameters", () => {
    const result = resolveUrl("/api/{version}/users/{userId}/", {
      version: "v1",
      userId: "99",
    });
    expect(result).toBe("/api/v1/users/99/");
  });

  it("encodes special characters", () => {
    const result = resolveUrl("/api/v1/users/{userId}/", {
      userId: "hello world",
    });
    expect(result).toBe("/api/v1/users/hello%20world/");
  });

  it("leaves template unchanged if param not provided", () => {
    const result = resolveUrl("/api/v1/users/{userId}/", {});
    expect(result).toBe("/api/v1/users/{userId}/");
  });
});

describe("defaultEndpoints", () => {
  it("contains all required endpoints", () => {
    const keys = [
      "userProfile",
      "userById",
      "followers",
      "following",
      "friendshipStatus",
      "userFeed",
      "likeMedia",
      "unlikeMedia",
    ];
    for (const key of keys) {
      expect(defaultEndpoints[key]).toBeDefined();
      expect(defaultEndpoints[key]?.url).toBeTruthy();
      expect(defaultEndpoints[key]?.method).toMatch(/^(GET|POST)$/);
    }
  });

  it("uses POST for like/unlike endpoints", () => {
    expect(defaultEndpoints.likeMedia?.method).toBe("POST");
    expect(defaultEndpoints.unlikeMedia?.method).toBe("POST");
  });

  it("uses GET for read endpoints", () => {
    expect(defaultEndpoints.userProfile?.method).toBe("GET");
    expect(defaultEndpoints.followers?.method).toBe("GET");
    expect(defaultEndpoints.userFeed?.method).toBe("GET");
  });
});
