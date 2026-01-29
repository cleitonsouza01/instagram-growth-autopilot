import { describe, it, expect } from "vitest";
import {
  scoreBotProbability,
  DEFAULT_BOT_THRESHOLD,
  type BotScoreInput,
} from "../../lib/bot-scorer";

function makeInput(overrides: Partial<BotScoreInput> = {}): BotScoreInput {
  return {
    username: "john_doe",
    fullName: "John Doe",
    hasProfilePic: true,
    biography: "Photographer & traveler",
    postCount: 120,
    followerCount: 1500,
    followingCount: 800,
    isPrivate: false,
    externalUrl: "https://johndoe.com",
    ...overrides,
  };
}

describe("BotScorer", () => {
  it("should give low score to legitimate-looking profile", () => {
    const result = scoreBotProbability(makeInput());
    expect(result.score).toBeLessThan(DEFAULT_BOT_THRESHOLD);
  });

  it("should give high score to empty bot-like profile", () => {
    const result = scoreBotProbability(
      makeInput({
        username: "follow_me_12345678",
        fullName: "Follow for Follow",
        hasProfilePic: false,
        biography: "",
        postCount: 0,
        followerCount: 5,
        followingCount: 7500,
        externalUrl: null,
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_BOT_THRESHOLD);
  });

  it("should penalize missing profile picture", () => {
    const withPic = scoreBotProbability(makeInput({ hasProfilePic: true }));
    const noPic = scoreBotProbability(makeInput({ hasProfilePic: false }));
    expect(noPic.score).toBeGreaterThan(withPic.score);
  });

  it("should penalize empty biography", () => {
    const withBio = scoreBotProbability(makeInput({ biography: "Hello world" }));
    const noBio = scoreBotProbability(makeInput({ biography: "" }));
    expect(noBio.score).toBeGreaterThan(withBio.score);
  });

  it("should penalize zero posts heavily", () => {
    const result = scoreBotProbability(makeInput({ postCount: 0 }));
    const withPosts = scoreBotProbability(makeInput({ postCount: 50 }));
    expect(result.score).toBeGreaterThan(withPosts.score);
  });

  it("should penalize suspicious username", () => {
    const normal = scoreBotProbability(makeInput({ username: "jane_photo" }));
    const suspicious = scoreBotProbability(
      makeInput({ username: "follow_me_123456" }),
    );
    expect(suspicious.score).toBeGreaterThan(normal.score);
  });

  it("should penalize extreme following count", () => {
    const normal = scoreBotProbability(makeInput({ followingCount: 500 }));
    const extreme = scoreBotProbability(makeInput({ followingCount: 7000 }));
    expect(extreme.score).toBeGreaterThan(normal.score);
  });

  it("should return signals array with details", () => {
    const result = scoreBotProbability(makeInput());
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.signals[0]).toHaveProperty("name");
    expect(result.signals[0]).toHaveProperty("weight");
    expect(result.signals[0]).toHaveProperty("value");
    expect(result.signals[0]).toHaveProperty("detail");
  });

  it("should include username and ratio analysis", () => {
    const result = scoreBotProbability(makeInput());
    expect(result.usernameAnalysis).toBeDefined();
    expect(result.ratioAnalysis).toBeDefined();
  });

  it("should cap score at 1.0", () => {
    const result = scoreBotProbability(
      makeInput({
        username: "follow_free_promo_12345678___",
        fullName: "Follow DM for Free Promo",
        hasProfilePic: false,
        biography: "",
        postCount: 0,
        followerCount: 0,
        followingCount: 10000,
        externalUrl: null,
      }),
    );
    expect(result.score).toBeLessThanOrEqual(1.0);
  });
});
