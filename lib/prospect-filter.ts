import type { Prospect, ActionLog } from "../storage/database";
import { FILTER_DEFAULTS } from "./constants";

export interface FilterConfig {
  minPostCount: number;
  skipPrivate: boolean;
  skipVerified: boolean;
  skipAlreadyFollowing: boolean;
  skipPreviouslyEngaged: boolean;
  reEngagementCooldownDays: number;
}

export interface FilterResult {
  passed: boolean;
  reason?: string;
}

/**
 * Evaluate whether a prospect should be queued for engagement.
 */
export function filterProspect(
  prospect: Prospect,
  config: Partial<FilterConfig> = {},
  engagementHistory: ActionLog[] = [],
): FilterResult {
  const cfg: FilterConfig = { ...FILTER_DEFAULTS, ...config };

  // Skip private accounts (can't view their feed)
  if (cfg.skipPrivate && prospect.isPrivate) {
    return { passed: false, reason: "private_account" };
  }

  // Skip verified accounts (unlikely to follow back)
  if (cfg.skipVerified && prospect.isVerified) {
    return { passed: false, reason: "verified_account" };
  }

  // Skip accounts with too few posts (likely inactive or bots)
  if (prospect.postCount < cfg.minPostCount) {
    return { passed: false, reason: "low_post_count" };
  }

  // Skip if previously engaged within cooldown period
  if (cfg.skipPreviouslyEngaged && engagementHistory.length > 0) {
    const cooldownMs = cfg.reEngagementCooldownDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const recentEngagement = engagementHistory.find(
      (log) =>
        log.targetUserId === prospect.platformUserId &&
        log.action === "like" &&
        log.success &&
        now - log.timestamp < cooldownMs,
    );

    if (recentEngagement) {
      return { passed: false, reason: "recently_engaged" };
    }
  }

  return { passed: true };
}
