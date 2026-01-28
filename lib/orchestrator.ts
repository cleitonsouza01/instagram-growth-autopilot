import {
  getEngineState,
  saveEngineState,
  getSettings,
  getDailyCounters,
  incrementDailyCounter,
  type PersistedEngineState,
} from "../storage/chrome-storage";
import { getNextProspect, markEngaged } from "./engagement-queue";
import { filterProspect } from "./prospect-filter";
import { engageProspect } from "./like-executor";
import { db } from "../storage/database";
import { logger } from "../utils/logger";
import { ActionBlockError, NotAuthenticatedError } from "../api/errors";

export type EngineState =
  | "idle"
  | "harvesting"
  | "engaging"
  | "paused"
  | "cooldown"
  | "error";

export interface EngineStatus {
  state: EngineState;
  todayLikes: number;
  dailyLimit: number;
  queueDepth: number;
  lastAction: number | null;
  cooldownEndsAt: number | null;
  activeCompetitor: string | null;
}

/**
 * Check if current time is within active hours.
 */
export function isWithinActiveHours(
  startHour: number,
  endHour: number,
): boolean {
  const currentHour = new Date().getHours();
  if (startHour <= endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }
  // Handle overnight range (e.g., 22 to 6)
  return currentHour >= startHour || currentHour < endHour;
}

/**
 * Get the full engine status (for display in popup).
 */
export async function getFullEngineStatus(): Promise<EngineStatus> {
  const state = await getEngineState();
  const settings = await getSettings();
  const counters = await getDailyCounters();
  const queueDepth = await db.prospects
    .where("status")
    .equals("queued")
    .count();

  return {
    state: state.state as EngineState,
    todayLikes: counters.likes,
    dailyLimit: settings.dailyLikeLimit,
    queueDepth,
    lastAction: state.lastAction,
    cooldownEndsAt: state.cooldownEndsAt,
    activeCompetitor: state.activeCompetitor,
  };
}

/**
 * Execute one engagement cycle.
 * Called by the service worker on each engage-tick alarm.
 *
 * Returns true if an engagement was performed, false if skipped.
 */
export async function executeEngagementCycle(
  signal: AbortSignal,
): Promise<boolean> {
  const state = await getEngineState();
  const settings = await getSettings();
  const counters = await getDailyCounters();

  // Guard: don't engage if paused, in cooldown, or error
  if (state.state === "paused" || state.state === "error") {
    return false;
  }

  // Guard: check cooldown
  if (state.state === "cooldown" && state.cooldownEndsAt) {
    if (Date.now() < state.cooldownEndsAt) {
      return false;
    }
    // Cooldown expired — resume
    await saveEngineState({ state: "idle", cooldownEndsAt: null });
  }

  // Guard: outside active hours
  if (
    !isWithinActiveHours(
      settings.activeHoursStart,
      settings.activeHoursEnd,
    )
  ) {
    logger.debug("orchestrator", "Outside active hours, skipping");
    return false;
  }

  // Guard: daily limit reached
  if (counters.likes >= settings.dailyLikeLimit) {
    logger.info(
      "orchestrator",
      `Daily like limit reached (${counters.likes}/${settings.dailyLikeLimit})`,
    );
    return false;
  }

  // Get next prospect from queue
  const prospect = await getNextProspect();
  if (!prospect || !prospect.id) {
    logger.debug("orchestrator", "No prospects in queue");
    return false;
  }

  // Apply filters
  const history = await db.actionLogs
    .where("targetUserId")
    .equals(prospect.igUserId)
    .toArray();

  const filterResult = filterProspect(
    prospect,
    {
      minPostCount: settings.minPostCount,
      skipPrivate: settings.skipPrivateAccounts,
      skipVerified: settings.skipVerifiedAccounts,
    },
    history,
  );

  if (!filterResult.passed) {
    await db.prospects.update(prospect.id, { status: "skipped" });
    logger.debug(
      "orchestrator",
      `Skipped @${prospect.username}: ${filterResult.reason}`,
    );
    return false;
  }

  // Engage the prospect
  await saveEngineState({ state: "engaging", lastAction: Date.now() });

  try {
    const result = await engageProspect(
      prospect,
      settings.likesPerProspect,
      signal,
    );

    // Update counters and prospect status
    if (result.postsLiked > 0) {
      await incrementDailyCounter("likes", result.postsLiked);
    }
    await markEngaged(prospect.id, result.postsLiked > 0);
    await saveEngineState({ state: "idle", lastAction: Date.now() });

    return result.postsLiked > 0;
  } catch (err) {
    if (err instanceof ActionBlockError) {
      logger.warn("orchestrator", "Action blocked! Entering cooldown.");
      const cooldownMs = settings.cooldownHours * 60 * 60 * 1000;
      await saveEngineState({
        state: "cooldown",
        cooldownEndsAt: Date.now() + cooldownMs,
      });
    } else if (err instanceof NotAuthenticatedError) {
      logger.error("orchestrator", "Session expired. Pausing engine.");
      await saveEngineState({ state: "error" });
    } else {
      logger.error(
        "orchestrator",
        "Unexpected error during engagement",
        err instanceof Error ? err.message : String(err),
      );
      await saveEngineState({ state: "idle" });
    }

    await markEngaged(prospect.id, false, String(err));
    return false;
  }
}
