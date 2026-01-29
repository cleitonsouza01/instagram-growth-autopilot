import { getDailyCounters } from "../storage/chrome-storage";
import { logger } from "../utils/logger";

/** Multi-layer rate limiting for safe automation */

export interface RateLimits {
  dailyLimit: number;
  hourlyLimit: number;
  sessionLimit: number;
  minActionDelayMs: number;
  maxActionDelayMs: number;
}

export interface SessionCounters {
  sessionActions: number;
  sessionStartedAt: number;
  hourlyActions: number;
  hourlyWindowStart: number;
  lastActionAt: number | null;
  consecutiveActions: number;
  breaksTaken: number;
}

const DEFAULT_SESSION: SessionCounters = {
  sessionActions: 0,
  sessionStartedAt: Date.now(),
  hourlyActions: 0,
  hourlyWindowStart: Date.now(),
  lastActionAt: null,
  consecutiveActions: 0,
  breaksTaken: 0,
};

let session: SessionCounters = { ...DEFAULT_SESSION };

export function resetSession(): void {
  session = { ...DEFAULT_SESSION, sessionStartedAt: Date.now(), hourlyWindowStart: Date.now() };
}

export function getSession(): SessionCounters {
  return { ...session };
}

export type RateLimitCheck =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfterMs: number };

/**
 * Check all rate-limit layers before performing an action.
 */
export async function checkRateLimits(limits: RateLimits): Promise<RateLimitCheck> {
  const now = Date.now();

  // Layer 1: Per-action minimum delay
  if (session.lastActionAt) {
    const elapsed = now - session.lastActionAt;
    if (elapsed < limits.minActionDelayMs) {
      const waitMs = limits.minActionDelayMs - elapsed;
      return { allowed: false, reason: "min_delay", retryAfterMs: waitMs };
    }
  }

  // Layer 2: Hourly limit
  const hourMs = 60 * 60 * 1000;
  if (now - session.hourlyWindowStart > hourMs) {
    // Reset hourly window
    session.hourlyActions = 0;
    session.hourlyWindowStart = now;
  }
  if (session.hourlyActions >= limits.hourlyLimit) {
    const retryAfterMs = hourMs - (now - session.hourlyWindowStart);
    logger.info("rate-limiter", `Hourly limit reached (${session.hourlyActions}/${limits.hourlyLimit})`);
    return { allowed: false, reason: "hourly_limit", retryAfterMs };
  }

  // Layer 3: Session limit (force break)
  if (session.sessionActions >= limits.sessionLimit) {
    const breakDurationMs = randomBetween(15 * 60 * 1000, 30 * 60 * 1000);
    logger.info("rate-limiter", `Session limit reached (${session.sessionActions}). Break for ${Math.round(breakDurationMs / 60000)}m`);
    session.sessionActions = 0;
    session.breaksTaken++;
    return { allowed: false, reason: "session_limit", retryAfterMs: breakDurationMs };
  }

  // Layer 4: Daily limit
  const counters = await getDailyCounters();
  if (counters.likes >= limits.dailyLimit) {
    const midnightMs = getMsUntilMidnight();
    logger.info("rate-limiter", `Daily limit reached (${counters.likes}/${limits.dailyLimit})`);
    return { allowed: false, reason: "daily_limit", retryAfterMs: midnightMs };
  }

  return { allowed: true };
}

/**
 * Record that an action was performed.
 */
export function recordAction(): void {
  const now = Date.now();
  session.sessionActions++;
  session.hourlyActions++;
  session.consecutiveActions++;
  session.lastActionAt = now;
}

/**
 * Record a break (resets consecutive counter).
 */
export function recordBreak(): void {
  session.consecutiveActions = 0;
  session.breaksTaken++;
}

/**
 * Check whether a natural break is due.
 * Returns break duration in ms, or 0 if no break needed.
 */
export function shouldTakeBreak(): number {
  const threshold = randomBetween(20, 40);
  if (session.consecutiveActions >= threshold) {
    session.consecutiveActions = 0;
    return randomBetween(5 * 60 * 1000, 15 * 60 * 1000);
  }
  return 0;
}

function getMsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
