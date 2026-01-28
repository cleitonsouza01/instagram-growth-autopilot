/** Default limits and timings for the growth engine */

export const HARVEST_DEFAULTS = {
  maxProspectsPerCompetitor: 200,
  pageFetchDelayMs: 5000,
  maxPagesPerSession: 10,
  followersPerPage: 50,
} as const;

export const ENGAGEMENT_DEFAULTS = {
  likesPerProspect: 2,
  minDelayBetweenLikesMs: 5000,
  maxDelayBetweenLikesMs: 15000,
  recentPostsToFetch: 12,
} as const;

export const FILTER_DEFAULTS = {
  minPostCount: 3,
  skipPrivate: true,
  skipVerified: false,
  skipAlreadyFollowing: true,
  skipPreviouslyEngaged: true,
  reEngagementCooldownDays: 30,
} as const;

export const ALARM_NAMES = {
  HARVEST: "harvest-tick",
  ENGAGE: "engage-tick",
  DAILY_RESET: "daily-reset",
  COOLDOWN_END: "cooldown-end",
} as const;

export const ENGINE_TIMINGS = {
  harvestIntervalMinutes: 30,
  engageIntervalMinutes: 2,
  maxEngageIntervalMinutes: 3,
} as const;
