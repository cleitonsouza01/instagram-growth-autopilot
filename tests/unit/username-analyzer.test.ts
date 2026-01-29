import { describe, it, expect } from "vitest";
import { analyzeUsername } from "../../lib/username-analyzer";

describe("UsernameAnalyzer", () => {
  it("should give low score to normal usernames", () => {
    expect(analyzeUsername("john_doe").score).toBe(0);
    expect(analyzeUsername("jane_photos").score).toBe(0);
    expect(analyzeUsername("mark_travel").score).toBe(0);
  });

  it("should flag excessive digits", () => {
    const result = analyzeUsername("user839274651");
    expect(result.score).toBeGreaterThan(0);
    expect(result.flags).toContain("excessive_digits");
  });

  it("should flag trailing digits", () => {
    const result = analyzeUsername("user_name_123");
    expect(result.score).toBeGreaterThan(0);
    expect(result.flags).toContain("trailing_digits");
  });

  it("should flag excessive underscores", () => {
    const result = analyzeUsername("user____name____123");
    expect(result.flags).toContain("excessive_underscores");
  });

  it("should flag bot prefixes", () => {
    const result = analyzeUsername("follow_me_now");
    expect(result.flags.some((f) => f.startsWith("bot_prefix"))).toBe(true);
  });

  it("should flag bot suffixes", () => {
    const result = analyzeUsername("john_official");
    expect(result.flags.some((f) => f.startsWith("bot_suffix"))).toBe(true);
  });

  it("should flag suspicious words", () => {
    const result = analyzeUsername("get_free_promo");
    expect(result.flags.some((f) => f.startsWith("suspicious_word"))).toBe(true);
  });

  it("should flag very long usernames", () => {
    const result = analyzeUsername("a_very_long_username_that_goes_on");
    expect(result.flags).toContain("very_long");
  });

  it("should flag random character sequences", () => {
    const result = analyzeUsername("xkjfnmtrpqs");
    expect(result.flags).toContain("random_chars");
  });

  it("should cap score at 1.0", () => {
    const result = analyzeUsername("follow_free_promo_12345678___bot");
    expect(result.score).toBeLessThanOrEqual(1.0);
  });
});
