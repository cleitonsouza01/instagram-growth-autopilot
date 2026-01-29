import { describe, it, expect } from "vitest";
import { filterProspect } from "../../lib/prospect-filter";
import type { Prospect, ActionLog } from "../../storage/database";

function makeProspect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: 1,
    platformUserId: "12345",
    username: "testuser",
    fullName: "Test User",
    profilePicUrl: "https://example.com/pic.jpg",
    isPrivate: false,
    isVerified: false,
    postCount: 50,
    followerCount: 1000,
    followingCount: 500,
    source: "competitor1",
    fetchedAt: Date.now(),
    engagedAt: null,
    status: "queued",
    ...overrides,
  };
}

describe("filterProspect", () => {
  it("passes a normal public prospect", () => {
    const result = filterProspect(makeProspect());
    expect(result.passed).toBe(true);
  });

  it("rejects private accounts", () => {
    const result = filterProspect(makeProspect({ isPrivate: true }));
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("private_account");
  });

  it("allows private accounts when skipPrivate is false", () => {
    const result = filterProspect(
      makeProspect({ isPrivate: true }),
      { skipPrivate: false },
    );
    expect(result.passed).toBe(true);
  });

  it("rejects verified accounts when configured", () => {
    const result = filterProspect(
      makeProspect({ isVerified: true }),
      { skipVerified: true },
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("verified_account");
  });

  it("allows verified accounts by default", () => {
    const result = filterProspect(makeProspect({ isVerified: true }));
    expect(result.passed).toBe(true);
  });

  it("rejects accounts with low post count", () => {
    const result = filterProspect(makeProspect({ postCount: 1 }));
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("low_post_count");
  });

  it("allows accounts at the minimum post count", () => {
    const result = filterProspect(makeProspect({ postCount: 3 }));
    expect(result.passed).toBe(true);
  });

  it("rejects recently engaged accounts", () => {
    const recentLog: ActionLog = {
      id: 1,
      action: "like",
      targetUserId: "12345",
      targetUsername: "testuser",
      success: true,
      timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
    };

    const result = filterProspect(makeProspect(), {}, [recentLog]);
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("recently_engaged");
  });

  it("allows accounts engaged beyond cooldown period", () => {
    const oldLog: ActionLog = {
      id: 1,
      action: "like",
      targetUserId: "12345",
      targetUsername: "testuser",
      success: true,
      timestamp: Date.now() - 1000 * 60 * 60 * 24 * 31, // 31 days ago
    };

    const result = filterProspect(makeProspect(), {}, [oldLog]);
    expect(result.passed).toBe(true);
  });

  it("ignores failed engagement history", () => {
    const failedLog: ActionLog = {
      id: 1,
      action: "like",
      targetUserId: "12345",
      targetUsername: "testuser",
      success: false,
      error: "rate_limited",
      timestamp: Date.now() - 1000 * 60, // 1 minute ago
    };

    const result = filterProspect(makeProspect(), {}, [failedLog]);
    expect(result.passed).toBe(true);
  });

  it("ignores engagement for other users", () => {
    const otherUserLog: ActionLog = {
      id: 1,
      action: "like",
      targetUserId: "99999",
      targetUsername: "otheruser",
      success: true,
      timestamp: Date.now(),
    };

    const result = filterProspect(makeProspect(), {}, [otherUserLog]);
    expect(result.passed).toBe(true);
  });
});
