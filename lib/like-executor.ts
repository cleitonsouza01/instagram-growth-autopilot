import { getUserFeed } from "../api/endpoints/media";
import { likeMedia } from "../api/endpoints/media";
import { db } from "../storage/database";
import type { Prospect } from "../storage/database";
import { randomDelay } from "../utils/delay";
import { logger } from "../utils/logger";
import { ENGAGEMENT_DEFAULTS } from "./constants";

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
    `Engaging @${prospect.username} (target: ${likesPerProspect} likes)`,
  );

  try {
    // Fetch recent feed
    const feed = await getUserFeed(
      prospect.igUserId,
      ENGAGEMENT_DEFAULTS.recentPostsToFetch,
      signal,
    );

    // Filter to unliked posts
    const unlikedPosts = feed.items.filter((item) => !item.has_liked);

    if (unlikedPosts.length === 0) {
      logger.info(
        "like-executor",
        `No unliked posts found for @${prospect.username}`,
      );
      return result;
    }

    // Select posts to like (up to likesPerProspect)
    const postsToLike = unlikedPosts.slice(0, likesPerProspect);

    for (const post of postsToLike) {
      if (signal.aborted) break;

      result.postsAttempted++;

      try {
        const response = await likeMedia(post.id, signal);

        if (response.status === "ok") {
          result.postsLiked++;

          // Log the action
          await db.actionLogs.add({
            action: "like",
            targetUserId: prospect.igUserId,
            targetUsername: prospect.username,
            mediaId: post.id,
            success: true,
            timestamp: Date.now(),
          });

          logger.debug(
            "like-executor",
            `Liked post ${post.id} from @${prospect.username}`,
          );
        } else {
          const errorMsg = response.spam
            ? "spam_detected"
            : "like_failed";
          result.errors.push(errorMsg);

          await db.actionLogs.add({
            action: "like",
            targetUserId: prospect.igUserId,
            targetUsername: prospect.username,
            mediaId: post.id,
            success: false,
            error: errorMsg,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        result.errors.push(errorMsg);

        await db.actionLogs.add({
          action: "like",
          targetUserId: prospect.igUserId,
          targetUsername: prospect.username,
          mediaId: post.id,
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

      // Human-like delay between likes
      if (!signal.aborted && result.postsAttempted < postsToLike.length) {
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
