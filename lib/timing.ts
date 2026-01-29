import { gaussianDelay } from "../utils/delay";

/**
 * Human-like timing generator.
 * Uses Gaussian distribution, time-of-day variation, and natural burst patterns.
 */

export interface TimingConfig {
  minDelayMs: number;
  maxDelayMs: number;
  burstProbability: number; // 0-1, chance of entering burst mode
  burstSpeedMultiplier: number; // e.g. 0.5 = half the delay
}

const DEFAULT_TIMING: TimingConfig = {
  minDelayMs: 30_000,
  maxDelayMs: 120_000,
  burstProbability: 0.15,
  burstSpeedMultiplier: 0.5,
};

/** Time-of-day multipliers: faster during peak hours, slower off-peak */
const HOUR_MULTIPLIERS: Record<number, number> = {
  6: 1.5, 7: 1.3, 8: 1.1, 9: 1.0, 10: 0.9,
  11: 0.8, 12: 0.8, 13: 0.85, 14: 0.9, 15: 0.95,
  16: 1.0, 17: 1.0, 18: 0.9, 19: 0.8, 20: 0.85,
  21: 0.9, 22: 1.1, 23: 1.3,
};

function getHourMultiplier(): number {
  const hour = new Date().getHours();
  return HOUR_MULTIPLIERS[hour] ?? 1.2;
}

/** Weekday vs weekend adjustment */
function getDayMultiplier(): number {
  const day = new Date().getDay();
  // Weekend = slightly slower
  return day === 0 || day === 6 ? 1.15 : 1.0;
}

/**
 * Generate a human-like delay in milliseconds.
 * Accounts for Gaussian distribution, time-of-day, and burst patterns.
 */
export function generateDelay(config: Partial<TimingConfig> = {}): number {
  const cfg = { ...DEFAULT_TIMING, ...config };

  // Base delay via Gaussian distribution
  let delayMs = gaussianDelay(cfg.minDelayMs, cfg.maxDelayMs);

  // Apply time-of-day multiplier
  delayMs *= getHourMultiplier();

  // Apply weekday/weekend multiplier
  delayMs *= getDayMultiplier();

  // Random burst mode: occasionally go faster
  if (Math.random() < cfg.burstProbability) {
    delayMs *= cfg.burstSpeedMultiplier;
  }

  // Add micro-jitter (±5%)
  const jitter = 1.0 + (Math.random() * 0.1 - 0.05);
  delayMs *= jitter;

  // Clamp to reasonable bounds
  return Math.round(Math.max(cfg.minDelayMs * 0.4, Math.min(cfg.maxDelayMs * 2, delayMs)));
}

/**
 * Generate a delay specifically for between-like pauses (shorter).
 */
export function generateLikeDelay(): number {
  return generateDelay({
    minDelayMs: 3_000,
    maxDelayMs: 8_000,
    burstProbability: 0.1,
    burstSpeedMultiplier: 0.6,
  });
}

/**
 * Generate a natural break duration (5-15 minutes).
 */
export function generateBreakDuration(): number {
  return gaussianDelay(5 * 60_000, 15 * 60_000);
}

/**
 * Determine whether the current timing context suggests a long pause.
 * Returns pause duration in ms (0 = no pause).
 */
export function suggestSessionPause(actionsInSession: number): number {
  // After 20-40 actions, suggest a break
  const threshold = 20 + Math.floor(Math.random() * 21);
  if (actionsInSession >= threshold) {
    return generateBreakDuration();
  }
  return 0;
}
