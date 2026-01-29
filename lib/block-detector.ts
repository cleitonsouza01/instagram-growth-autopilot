import { logger } from "../utils/logger";

/**
 * Action block detection with severity levels.
 * Tracks block signals and determines appropriate cooldown periods.
 */

export const BlockSeverity = {
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
} as const;

export type BlockSeverity = (typeof BlockSeverity)[keyof typeof BlockSeverity];

export interface BlockEvent {
  severity: BlockSeverity;
  signal: string;
  cooldownMs: number;
  timestamp: number;
}

export interface BlockState {
  consecutiveFailures: number;
  recentBlocks: BlockEvent[];
  lastBlockAt: number | null;
  totalBlocksToday: number;
}

const COOLDOWN_DURATIONS = {
  [BlockSeverity.NONE]: 0,
  [BlockSeverity.LOW]: 60 * 60 * 1000, // 1 hour
  [BlockSeverity.MEDIUM]: 12 * 60 * 60 * 1000, // 12 hours
  [BlockSeverity.HIGH]: 24 * 60 * 60 * 1000, // 24 hours
  [BlockSeverity.CRITICAL]: 48 * 60 * 60 * 1000, // 48 hours
} as const;

let state: BlockState = {
  consecutiveFailures: 0,
  recentBlocks: [],
  lastBlockAt: null,
  totalBlocksToday: 0,
};

export function getBlockState(): BlockState {
  return { ...state, recentBlocks: [...state.recentBlocks] };
}

export function resetBlockState(): void {
  state = {
    consecutiveFailures: 0,
    recentBlocks: [],
    lastBlockAt: null,
    totalBlocksToday: 0,
  };
}

/**
 * Classify a block signal into a severity level and cooldown.
 */
export function classifyBlock(signal: string, httpStatus?: number): BlockEvent {
  let severity: BlockSeverity;

  if (signal === "checkpoint_required") {
    severity = BlockSeverity.CRITICAL;
  } else if (signal === "feedback_required") {
    severity = BlockSeverity.HIGH;
  } else if (signal === "spam_detected") {
    severity = BlockSeverity.MEDIUM;
  } else if (httpStatus === 429) {
    severity = BlockSeverity.LOW;
  } else if (signal === "consecutive_failures") {
    severity = BlockSeverity.MEDIUM;
  } else {
    severity = BlockSeverity.LOW;
  }

  // Escalate if we've had recent blocks
  if (state.totalBlocksToday >= 3 && severity === BlockSeverity.LOW) {
    severity = BlockSeverity.MEDIUM;
  }
  if (state.totalBlocksToday >= 5 && severity === BlockSeverity.MEDIUM) {
    severity = BlockSeverity.HIGH;
  }

  const event: BlockEvent = {
    severity,
    signal,
    cooldownMs: COOLDOWN_DURATIONS[severity],
    timestamp: Date.now(),
  };

  // Update state
  state.recentBlocks.push(event);
  state.lastBlockAt = event.timestamp;
  state.totalBlocksToday++;

  // Keep only last 20 events
  if (state.recentBlocks.length > 20) {
    state.recentBlocks = state.recentBlocks.slice(-20);
  }

  logger.warn("block-detector", `Block detected: ${signal} → ${severity} (cooldown: ${Math.round(event.cooldownMs / 60000)}m)`);

  return event;
}

/**
 * Record a successful action (resets consecutive failure counter).
 */
export function recordSuccess(): void {
  state.consecutiveFailures = 0;
}

/**
 * Record a failed action. Returns a block event if threshold reached.
 */
export function recordFailure(): BlockEvent | null {
  state.consecutiveFailures++;

  if (state.consecutiveFailures >= 3) {
    const event = classifyBlock("consecutive_failures");
    state.consecutiveFailures = 0;
    return event;
  }

  return null;
}

/**
 * Determine the current safety level for UI display.
 */
export function getSafetyLevel(): {
  level: "safe" | "caution" | "warning" | "danger";
  message: string;
} {
  if (state.totalBlocksToday === 0 && state.consecutiveFailures === 0) {
    return { level: "safe", message: "All systems normal" };
  }

  if (state.totalBlocksToday >= 5 || state.consecutiveFailures >= 3) {
    return { level: "danger", message: "Multiple blocks detected - extended cooldown active" };
  }

  if (state.totalBlocksToday >= 2) {
    return { level: "warning", message: "Repeated blocks - slowing down" };
  }

  if (state.totalBlocksToday >= 1 || state.consecutiveFailures >= 1) {
    return { level: "caution", message: "Minor issue detected - monitoring" };
  }

  return { level: "safe", message: "All systems normal" };
}

/**
 * Reset daily block counters (call at midnight).
 */
export function resetDailyBlocks(): void {
  state.totalBlocksToday = 0;
  state.recentBlocks = [];
}
