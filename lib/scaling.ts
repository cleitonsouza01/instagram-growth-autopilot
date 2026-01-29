/**
 * Progressive account scaling based on account age/maturity.
 * Recommends safe limits for different account stages.
 */

export const AccountTier = {
  NEW: "new",
  YOUNG: "young",
  GROWING: "growing",
  ESTABLISHED: "established",
  MATURE: "mature",
} as const;

export type AccountTier = (typeof AccountTier)[keyof typeof AccountTier];

export interface ScalingRecommendation {
  tier: AccountTier;
  dailyLimit: number;
  hourlyLimit: number;
  minDelayMs: number;
  maxDelayMs: number;
  description: string;
  warning: string | null;
}

const TIER_CONFIG: Record<AccountTier, Omit<ScalingRecommendation, "tier">> = {
  [AccountTier.NEW]: {
    dailyLimit: 50,
    hourlyLimit: 10,
    minDelayMs: 60_000,
    maxDelayMs: 180_000,
    description: "Account is less than 14 days old",
    warning: "New accounts are fragile. Automation is not recommended.",
  },
  [AccountTier.YOUNG]: {
    dailyLimit: 100,
    hourlyLimit: 15,
    minDelayMs: 45_000,
    maxDelayMs: 150_000,
    description: "Account is 14-30 days old",
    warning: "Use very conservative settings.",
  },
  [AccountTier.GROWING]: {
    dailyLimit: 200,
    hourlyLimit: 25,
    minDelayMs: 35_000,
    maxDelayMs: 120_000,
    description: "Account is 1-3 months old",
    warning: null,
  },
  [AccountTier.ESTABLISHED]: {
    dailyLimit: 300,
    hourlyLimit: 35,
    minDelayMs: 30_000,
    maxDelayMs: 100_000,
    description: "Account is 3-6 months old",
    warning: null,
  },
  [AccountTier.MATURE]: {
    dailyLimit: 500,
    hourlyLimit: 50,
    minDelayMs: 25_000,
    maxDelayMs: 90_000,
    description: "Account is 6+ months old",
    warning: null,
  },
};

/**
 * Determine account tier from age in days.
 */
export function getAccountTier(accountAgeDays: number): AccountTier {
  if (accountAgeDays < 14) return AccountTier.NEW;
  if (accountAgeDays < 30) return AccountTier.YOUNG;
  if (accountAgeDays < 90) return AccountTier.GROWING;
  if (accountAgeDays < 180) return AccountTier.ESTABLISHED;
  return AccountTier.MATURE;
}

/**
 * Get scaling recommendation for an account age.
 */
export function getScalingRecommendation(accountAgeDays: number): ScalingRecommendation {
  const tier = getAccountTier(accountAgeDays);
  return { tier, ...TIER_CONFIG[tier] };
}

/**
 * Validate user settings against scaling recommendations.
 * Returns a list of warnings if settings exceed recommended limits.
 */
export function validateSettingsAgainstScaling(
  accountAgeDays: number,
  userDailyLimit: number,
  userHourlyLimit?: number,
): string[] {
  const rec = getScalingRecommendation(accountAgeDays);
  const warnings: string[] = [];

  if (rec.warning) {
    warnings.push(rec.warning);
  }

  if (userDailyLimit > rec.dailyLimit) {
    warnings.push(
      `Daily limit (${userDailyLimit}) exceeds recommended maximum (${rec.dailyLimit}) for ${rec.tier} accounts.`,
    );
  }

  if (userHourlyLimit !== undefined && userHourlyLimit > rec.hourlyLimit) {
    warnings.push(
      `Hourly limit (${userHourlyLimit}) exceeds recommended maximum (${rec.hourlyLimit}) for ${rec.tier} accounts.`,
    );
  }

  return warnings;
}
