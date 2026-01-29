import { analyzeUsername, type UsernameAnalysis } from "./username-analyzer";
import { analyzeRatio, type RatioAnalysis } from "./ratio-analyzer";

/**
 * Heuristic bot scoring engine.
 * Produces a 0.0-1.0 bot probability score from profile signals.
 */

export interface BotScoreInput {
  username: string;
  fullName: string;
  hasProfilePic: boolean;
  biography: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  isPrivate: boolean;
  externalUrl: string | null;
}

export interface BotScoreResult {
  score: number; // 0.0 (human) to 1.0 (bot)
  signals: BotSignal[];
  usernameAnalysis: UsernameAnalysis;
  ratioAnalysis: RatioAnalysis;
}

export interface BotSignal {
  name: string;
  weight: number;
  value: number; // 0.0 or weight
  detail: string;
}

const WEIGHTS = {
  noProfilePic: 0.15,
  emptyBio: 0.10,
  noPosts: 0.20,
  usernamePattern: 0.10,
  followerRatio: 0.15,
  extremeFollowing: 0.10,
  lowPostsForAge: 0.10,
  genericName: 0.05,
  noExternalUrl: 0.05,
} as const;

/**
 * Compute a bot probability score for a profile.
 */
export function scoreBotProbability(input: BotScoreInput): BotScoreResult {
  const signals: BotSignal[] = [];

  // Signal 1: No profile picture
  const noPicValue = input.hasProfilePic ? 0 : WEIGHTS.noProfilePic;
  signals.push({
    name: "no_profile_pic",
    weight: WEIGHTS.noProfilePic,
    value: noPicValue,
    detail: input.hasProfilePic ? "Has profile picture" : "No profile picture",
  });

  // Signal 2: Empty biography
  const emptyBio = input.biography.trim().length === 0;
  const emptyBioValue = emptyBio ? WEIGHTS.emptyBio : 0;
  signals.push({
    name: "empty_bio",
    weight: WEIGHTS.emptyBio,
    value: emptyBioValue,
    detail: emptyBio ? "Empty biography" : "Has biography",
  });

  // Signal 3: No posts (or very few)
  let noPostsValue = 0;
  if (input.postCount === 0) {
    noPostsValue = WEIGHTS.noPosts;
  } else if (input.postCount <= 2) {
    noPostsValue = WEIGHTS.noPosts * 0.5;
  }
  signals.push({
    name: "no_posts",
    weight: WEIGHTS.noPosts,
    value: noPostsValue,
    detail: `${input.postCount} posts`,
  });

  // Signal 4: Username pattern
  const usernameAnalysis = analyzeUsername(input.username);
  const usernameValue = Math.min(WEIGHTS.usernamePattern, usernameAnalysis.score * WEIGHTS.usernamePattern);
  signals.push({
    name: "username_pattern",
    weight: WEIGHTS.usernamePattern,
    value: usernameValue,
    detail: usernameAnalysis.flags.length > 0
      ? `Flags: ${usernameAnalysis.flags.join(", ")}`
      : "Normal username",
  });

  // Signal 5: Follower/following ratio
  const ratioAnalysis = analyzeRatio(input.followerCount, input.followingCount);
  const ratioValue = Math.min(WEIGHTS.followerRatio, ratioAnalysis.score * WEIGHTS.followerRatio);
  signals.push({
    name: "follower_ratio",
    weight: WEIGHTS.followerRatio,
    value: ratioValue,
    detail: `Ratio: ${ratioAnalysis.ratio.toFixed(2)} (${ratioAnalysis.flags.join(", ") || "normal"})`,
  });

  // Signal 6: Extreme following count
  const extremeFollowing = input.followingCount > 5000;
  const extremeValue = extremeFollowing ? WEIGHTS.extremeFollowing : 0;
  signals.push({
    name: "extreme_following",
    weight: WEIGHTS.extremeFollowing,
    value: extremeValue,
    detail: `Following ${input.followingCount}`,
  });

  // Signal 7: Low posts for implied age (heuristic)
  // If following many but posting few, suspicious
  const lowActivity = input.followingCount > 500 && input.postCount < 5;
  const lowActivityValue = lowActivity ? WEIGHTS.lowPostsForAge : 0;
  signals.push({
    name: "low_posts_for_activity",
    weight: WEIGHTS.lowPostsForAge,
    value: lowActivityValue,
    detail: lowActivity
      ? `${input.postCount} posts but following ${input.followingCount}`
      : "Normal activity level",
  });

  // Signal 8: Generic full name patterns
  const genericName = isGenericName(input.fullName);
  const genericNameValue = genericName ? WEIGHTS.genericName : 0;
  signals.push({
    name: "generic_name",
    weight: WEIGHTS.genericName,
    value: genericNameValue,
    detail: genericName ? "Generic or spammy name" : "Normal name",
  });

  // Signal 9: No external URL
  const noUrl = !input.externalUrl;
  const noUrlValue = noUrl ? WEIGHTS.noExternalUrl : 0;
  signals.push({
    name: "no_external_url",
    weight: WEIGHTS.noExternalUrl,
    value: noUrlValue,
    detail: noUrl ? "No external URL" : "Has external URL",
  });

  // Sum weighted signals
  const totalScore = signals.reduce((sum, s) => sum + s.value, 0);

  return {
    score: Math.min(1.0, totalScore),
    signals,
    usernameAnalysis,
    ratioAnalysis,
  };
}

function isGenericName(fullName: string): boolean {
  if (!fullName || fullName.trim().length === 0) return false;

  const lower = fullName.toLowerCase();
  const spamPatterns = [
    /follow/,
    /f4f/,
    /free/,
    /promo/,
    /official/,
    /\d{4,}/,
    /dm\s*(me|for)/,
  ];

  return spamPatterns.some((p) => p.test(lower));
}

/**
 * Default bot score threshold. Prospects at or above this are skipped.
 */
export const DEFAULT_BOT_THRESHOLD = 0.6;
