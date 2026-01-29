import {
  getEngineState,
  saveEngineState,
  getSettings,
  getDailyCounters,
  incrementDailyCounter,
} from "../storage/chrome-storage";
import { getNextProspect, markEngaged } from "./engagement-queue";
import { filterProspect } from "./prospect-filter";
import { engageProspect } from "./like-executor";
import { db } from "../storage/database";
import { logger } from "../utils/logger";
import { ActionBlockError, NotAuthenticatedError } from "../api/errors";
import { getUserById } from "../api/endpoints/user";

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

  logger.info("orchestrator", "executeEngagementCycle started", {
    state: state.state,
    activeHoursStart: settings.activeHoursStart,
    activeHoursEnd: settings.activeHoursEnd,
    currentHour: new Date().getHours(),
    likesCount: counters.likes,
    likeLimit: settings.dailyLikeLimit,
  });

  // Guard: don't engage if paused, in cooldown, or error
  if (state.state === "paused" || state.state === "error") {
    logger.info("orchestrator", `Skipping: state is ${state.state}`);
    return false;
  }

  // Guard: check cooldown
  if (state.state === "cooldown" && state.cooldownEndsAt) {
    if (Date.now() < state.cooldownEndsAt) {
      logger.info("orchestrator", "Skipping: in cooldown period");
      return false;
    }
    // Cooldown expired - resume
    await saveEngineState({ state: "idle", cooldownEndsAt: null });
  }

  // Guard: outside active hours
  const withinActiveHours = isWithinActiveHours(
    settings.activeHoursStart,
    settings.activeHoursEnd,
  );
  if (!withinActiveHours) {
    logger.info("orchestrator", "Skipping: outside active hours", {
      currentHour: new Date().getHours(),
      start: settings.activeHoursStart,
      end: settings.activeHoursEnd,
    });
    return false;
  }

  // Guard: daily limit reached
  if (counters.likes >= settings.dailyLikeLimit) {
    logger.info(
      "orchestrator",
      `Skipping: daily like limit reached (${counters.likes}/${settings.dailyLikeLimit})`,
    );
    return false;
  }

  // Get next prospect from queue
  logger.info("orchestrator", "Getting next prospect from queue...");
  const prospect = await getNextProspect();
  if (!prospect || !prospect.id) {
    logger.info("orchestrator", "Skipping: no prospects in queue with status=queued");
    return false;
  }
  logger.info("orchestrator", `Got prospect: @${prospect.username}`, {
    prospectId: prospect.id,
    platformUserId: prospect.platformUserId,
    status: prospect.status,
  });

  // Fetch fresh user profile to get accurate post count (harvesting doesn't include this)
  // Track whether we got valid profile data - if not, we'll skip post count filtering
  let hasValidPostCount = false;

  logger.debug("orchestrator", `Fetching profile for @${prospect.username}`);
  try {
    const freshProfile = await getUserById(prospect.platformUserId);

    // Validate that we got a real profile with the expected fields
    if (
      freshProfile &&
      typeof freshProfile.media_count === "number" &&
      freshProfile.media_count >= 0
    ) {
      // Update prospect with real data
      prospect.postCount = freshProfile.media_count;
      prospect.followerCount = freshProfile.follower_count ?? 0;
      prospect.followingCount = freshProfile.following_count ?? 0;
      prospect.isPrivate = freshProfile.is_private ?? prospect.isPrivate;
      prospect.isVerified = freshProfile.is_verified ?? prospect.isVerified;
      hasValidPostCount = true;

      // Save updated data to DB
      await db.prospects.update(prospect.id, {
        postCount: prospect.postCount,
        followerCount: prospect.followerCount,
        followingCount: prospect.followingCount,
        isPrivate: prospect.isPrivate,
        isVerified: prospect.isVerified,
      });

      logger.info("orchestrator", `Updated @${prospect.username} profile`, {
        postCount: prospect.postCount,
        followerCount: prospect.followerCount,
      });
    } else {
      // API returned something but without valid media_count
      logger.warn("orchestrator", `Profile for @${prospect.username} missing media_count`, {
        hasProfile: !!freshProfile,
        mediaCount: freshProfile?.media_count,
        responseKeys: freshProfile ? Object.keys(freshProfile) : [],
      });
    }
  } catch (err) {
    logger.warn("orchestrator", `Failed to fetch profile for @${prospect.username}`, {
      error: err instanceof Error ? err.message : String(err),
    });
    // hasValidPostCount remains false - we'll skip post count filtering
  }

  // Apply filters (now with accurate data, or skip post count check if data unavailable)
  const history = await db.actionLogs
    .where("targetUserId")
    .equals(prospect.platformUserId)
    .toArray();

  // If we couldn't get valid post count, skip that filter (use minPostCount: 0)
  // This prevents silent filtering when API fails
  const effectiveMinPostCount = hasValidPostCount ? settings.minPostCount : 0;
  if (!hasValidPostCount) {
    logger.info(
      "orchestrator",
      `Skipping post count filter for @${prospect.username} (profile data unavailable)`,
    );
  }

  const filterResult = filterProspect(
    prospect,
    {
      minPostCount: effectiveMinPostCount,
      skipPrivate: settings.skipPrivateAccounts,
      skipVerified: settings.skipVerifiedAccounts,
    },
    history,
  );

  if (!filterResult.passed) {
    await db.prospects.update(prospect.id, { status: "skipped" });
    logger.info(
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
