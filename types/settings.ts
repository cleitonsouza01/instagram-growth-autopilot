export interface UserSettings {
  // Platform configuration
  platformBaseUrl: string;

  // Competitors (for harvesting followers)
  competitors: string[];

  // Target profiles (for following their followers)
  targetProfiles: string[];

  // Like settings
  likesEnabled: boolean;
  dailyLikeLimit: number;
  likesPerProspect: number;

  // Follow settings
  followEnabled: boolean;
  dailyFollowLimit: number;
  unfollowAfterDays: number; // 0 = never unfollow

  // Timing
  activeHoursStart: number;
  activeHoursEnd: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;

  // Safety
  pauseOnBlock: boolean;
  cooldownHours: number;

  // Filters
  minFollowers: number;
  maxFollowers: number;
  minPostCount: number;
  maxFollowingRatio: number; // following/followers ratio threshold
  skipPrivateAccounts: boolean;
  skipVerifiedAccounts: boolean;
  skipBusinessAccounts: boolean;

  // UI
  theme: "light" | "dark" | "system";
}

export const DEFAULT_SETTINGS: UserSettings = {
  platformBaseUrl: "https://www.instagram.com",
  competitors: [],
  targetProfiles: [],
  likesEnabled: true,
  dailyLikeLimit: 100,
  likesPerProspect: 2,
  followEnabled: false,
  dailyFollowLimit: 50,
  unfollowAfterDays: 3,
  activeHoursStart: 8,
  activeHoursEnd: 23,
  minDelaySeconds: 30,
  maxDelaySeconds: 120,
  pauseOnBlock: true,
  cooldownHours: 24,
  minFollowers: 100,
  maxFollowers: 10000,
  minPostCount: 3,
  maxFollowingRatio: 2,
  skipPrivateAccounts: true,
  skipVerifiedAccounts: false,
  skipBusinessAccounts: false,
  theme: "system",
};
