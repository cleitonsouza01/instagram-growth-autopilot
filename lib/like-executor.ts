import { getUserFeed } from "../api/endpoints/media";
import { likeMedia } from "../api/endpoints/media";
import type { Prospect } from "../storage/database";
import { randomDelay } from "../utils/delay";
import { logger } from "../utils/logger";
import { ENGAGEMENT_DEFAULTS } from "./constants";
import { ContentNotFoundError } from "../api/errors";
import { MessageType } from "../types/messages";

/**
 * Log an action by sending it to the background script.
 * The background script writes to IndexedDB in the extension's origin,
 * which is shared with the options page.
 */
async function logAction(action: {
  action: "like" | "unlike" | "harvest" | "filter";
  targetUserId: string;
  targetUsername: string;
  mediaId?: string;
  success: boolean;
  error?: string;
  timestamp: number;
}): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: MessageType.LOG_ACTION,
      payload: action,
    });
  } catch (err) {
    // Don't fail the like operation if logging fails
    logger.warn("like-executor", "Failed to log action to background", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface LikeExecutionResult {
  prospectId: number;
  username: string;
  postsLiked: number;
  postsAttempted: number;
  errors: string[];
}

/**
 * Engage a single prospect by liking their recent posts.
 *
 * Flow:
 * 1. Fetch prospect's recent feed
 * 2. Filter to posts not already liked
 * 3. Like N posts with human-like delays
 * 4. Log each action to actionLogs
 */
export async function engageProspect(
  prospect: Prospect,
  likesPerProspect: number = ENGAGEMENT_DEFAULTS.likesPerProspect,
  signal: AbortSignal,
): Promise<LikeExecutionResult> {
  const result: LikeExecutionResult = {
    prospectId: prospect.id!,
    username: prospect.username,
    postsLiked: 0,
    postsAttempted: 0,
    errors: [],
  };

  logger.info(
    "like-executor",
    `[v2] Engaging @${prospect.username} (target: ${likesPerProspect} likes)`,
  );

  try {
    // Fetch recent feed
    const feed = await getUserFeed(
      prospect.platformUserId,
      ENGAGEMENT_DEFAULTS.recentPostsToFetch,
      signal,
    );

    // Filter to unliked posts
    const unlikedPosts = feed.items.filter((item) => !item.has_liked);

    // Debug: log the first post's id vs pk to understand format
    if (feed.items.length > 0) {
      const sample = feed.items[0];
      logger.debug("like-executor", "Media ID format sample", {
        id: sample.id,
        pk: sample.pk,
        idLength: sample.id?.length,
        pkLength: sample.pk?.length,
      });
    }

    if (unlikedPosts.length === 0) {
      logger.info(
        "like-executor",
        `No unliked posts found for @${prospect.username}`,
      );
      return result;
    }

    // Try posts until we get likesPerProspect successful likes
    // (some posts may be deleted, so we may need to try more than likesPerProspect)
    logger.debug("like-executor", `Starting like loop for @${prospect.username}`, {
      unlikedPostsCount: unlikedPosts.length,
      targetLikes: likesPerProspect,
    });

    for (const post of unlikedPosts) {
      if (signal.aborted) break;
      // Stop once we've liked enough posts
      if (result.postsLiked >= likesPerProspect) break;

      result.postsAttempted++;
      // Use post.pk (numeric ID), NOT post.id (which may include owner suffix)
      const mediaId = post.pk || post.id;
      logger.info("like-executor", `[${result.postsAttempted}] BEFORE likeMedia for post pk=${mediaId.slice(-12)}`);

      try {
        const response = await likeMedia(mediaId, signal);
        logger.info("like-executor", `[${result.postsAttempted}] AFTER likeMedia - status: ${response?.status}`);

        if (response.status === "ok") {
          result.postsLiked++;

          // Log the action (to background script for IndexedDB persistence)
          await logAction({
            action: "like",
            targetUserId: prospect.platformUserId,
            targetUsername: prospect.username,
            mediaId: mediaId,
            success: true,
            timestamp: Date.now(),
          });

          logger.debug(
            "like-executor",
            `Liked post ${mediaId} from @${prospect.username}`,
          );
        } else {
          const errorMsg = response.spam
            ? "spam_detected"
            : "like_failed";
          result.errors.push(errorMsg);

          await logAction({
            action: "like",
            targetUserId: prospect.platformUserId,
            targetUsername: prospect.username,
            mediaId: mediaId,
            success: false,
            error: errorMsg,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        const errorName = err instanceof Error ? err.constructor.name : "unknown";

        logger.debug("like-executor", `likeMedia error for post ${mediaId}`, {
          errorName,
          errorMsg: errorMsg.slice(0, 200),
        });

        // Handle deleted content gracefully - just skip this post
        if (err instanceof ContentNotFoundError) {
          logger.info(
            "like-executor",
            `Skipping deleted post ${mediaId} from @${prospect.username}`,
          );
          // Don't count as an error, don't log to actionLogs, just continue
          continue;
        }

        result.errors.push(errorMsg);

        await logAction({
          action: "like",
          targetUserId: prospect.platformUserId,
          targetUsername: prospect.username,
          mediaId: mediaId,
          success: false,
          error: errorMsg,
          timestamp: Date.now(),
        });

        // Re-throw action blocks and auth errors (don't continue)
        if (
          errorMsg.includes("Action blocked") ||
          errorMsg.includes("Not authenticated")
        ) {
          throw err;
        }
      }

      // Human-like delay between likes (only if we successfully liked and need more)
      if (!signal.aborted && result.postsLiked > 0 && result.postsLiked < likesPerProspect) {
        await randomDelay(
          ENGAGEMENT_DEFAULTS.minDelayBetweenLikesMs,
          ENGAGEMENT_DEFAULTS.maxDelayBetweenLikesMs,
        );
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(errorMsg);
    logger.error(
      "like-executor",
      `Error engaging @${prospect.username}: ${errorMsg}`,
    );
    throw err; // Re-throw for the orchestrator to handle
  }

  logger.info(
    "like-executor",
    `Engagement complete for @${prospect.username}: ${result.postsLiked}/${result.postsAttempted} liked`,
  );

  return result;
}
