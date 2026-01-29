/**
 * Analyzes follower/following ratio for bot-like behavior.
 * Returns a score 0.0 (normal) to 1.0 (very suspicious).
 */

export interface RatioAnalysis {
  score: number;
  ratio: number;
  flags: string[];
}

/**
 * Analyze follower/following ratio.
 */
export function analyzeRatio(
  followerCount: number,
  followingCount: number,
): RatioAnalysis {
  const flags: string[] = [];
  let score = 0;

  // Avoid division by zero
  const ratio = followerCount === 0
    ? (followingCount > 0 ? 0 : 1)
    : followerCount / Math.max(followingCount, 1);

  // Mass-following: following >> followers
  if (followingCount > 5000) {
    flags.push("extreme_following");
    score += 0.3;
  } else if (followingCount > 2000) {
    flags.push("high_following");
    score += 0.15;
  }

  // Very low ratio (mass-follower behavior)
  if (ratio < 0.1 && followingCount > 500) {
    flags.push("very_low_ratio");
    score += 0.35;
  } else if (ratio < 0.3 && followingCount > 300) {
    flags.push("low_ratio");
    score += 0.2;
  }

  // Zero followers but following many
  if (followerCount === 0 && followingCount > 100) {
    flags.push("zero_followers_mass_following");
    score += 0.4;
  }

  // Unusually high follower count with no engagement signals
  // (This is a heuristic - accounts with millions of followers are likely real)
  if (followerCount > 100000 && followingCount < 100) {
    // Celebrity-like ratio - probably real
    score = Math.max(0, score - 0.2);
  }

  return { score: Math.min(1.0, score), ratio, flags };
}
