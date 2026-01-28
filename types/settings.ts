export interface UserSettings {
  // Competitors
  competitors: string[];

  // Engagement limits
  dailyLikeLimit: number;
  likesPerProspect: number;

  // Timing
  activeHoursStart: number;
  activeHoursEnd: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;

  // Safety
  pauseOnBlock: boolean;
  cooldownHours: number;

  // Filters
  minPostCount: number;
  skipPrivateAccounts: boolean;
  skipVerifiedAccounts: boolean;

  // UI
  theme: "light" | "dark" | "system";
}

export const DEFAULT_SETTINGS: UserSettings = {
  competitors: [],
  dailyLikeLimit: 100,
  likesPerProspect: 2,
  activeHoursStart: 8,
  activeHoursEnd: 23,
  minDelaySeconds: 30,
  maxDelaySeconds: 120,
  pauseOnBlock: true,
  cooldownHours: 24,
  minPostCount: 3,
  skipPrivateAccounts: true,
  skipVerifiedAccounts: false,
  theme: "system",
};
