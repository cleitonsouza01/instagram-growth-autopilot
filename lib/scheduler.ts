import { db } from "../storage/database";
import { logger } from "../utils/logger";

/**
 * Content scheduler - schedule posts for future publishing.
 * Uses chrome.alarms for trigger and IndexedDB for persistence.
 */

export interface ScheduledPost {
  id?: number;
  type: "photo" | "story" | "carousel";
  caption: string;
  mediaBlobs: ArrayBuffer[]; // Stored as ArrayBuffers in IDB
  locationId: string | null;
  scheduledAt: number; // Unix timestamp
  status: "scheduled" | "publishing" | "published" | "failed";
  publishedMediaId: string | null;
  error: string | null;
  createdAt: number;
}

const ALARM_PREFIX = "scheduled-post-";

/**
 * Schedule a new post for future publication.
 */
export async function schedulePost(
  post: Omit<ScheduledPost, "id" | "status" | "publishedMediaId" | "error" | "createdAt">,
): Promise<number> {
  const entry: Omit<ScheduledPost, "id"> = {
    ...post,
    status: "scheduled",
    publishedMediaId: null,
    error: null,
    createdAt: Date.now(),
  };

  const id = await db.table("scheduledPosts").add(entry);
  const numId = typeof id === "number" ? id : Number(id);

  // Create chrome alarm
  const alarmName = `${ALARM_PREFIX}${numId}`;
  const delayMs = post.scheduledAt - Date.now();

  if (delayMs > 0) {
    await chrome.alarms.create(alarmName, {
      when: post.scheduledAt,
    });
    logger.info("scheduler", `Post scheduled (id: ${numId}) for ${new Date(post.scheduledAt).toISOString()}`);
  } else {
    logger.warn("scheduler", `Post scheduled in the past (id: ${numId}), will publish immediately`);
    await chrome.alarms.create(alarmName, { delayInMinutes: 0.5 });
  }

  return numId;
}

/**
 * Cancel a scheduled post.
 */
export async function cancelScheduledPost(postId: number): Promise<void> {
  await db.table("scheduledPosts").update(postId, { status: "failed", error: "Cancelled by user" });
  await chrome.alarms.clear(`${ALARM_PREFIX}${postId}`);
  logger.info("scheduler", `Post cancelled (id: ${postId})`);
}

/**
 * Get all scheduled posts, optionally filtered by status.
 */
export async function getScheduledPosts(
  status?: ScheduledPost["status"],
): Promise<ScheduledPost[]> {
  if (status) {
    return db.table("scheduledPosts").where("status").equals(status).toArray();
  }
  return db.table("scheduledPosts").orderBy("scheduledAt").toArray();
}

/**
 * Mark a post as publishing (called when alarm fires).
 */
export async function markPublishing(postId: number): Promise<void> {
  await db.table("scheduledPosts").update(postId, { status: "publishing" });
}

/**
 * Mark a post as published.
 */
export async function markPublished(postId: number, mediaId: string): Promise<void> {
  await db.table("scheduledPosts").update(postId, {
    status: "published",
    publishedMediaId: mediaId,
  });
  logger.info("scheduler", `Post published (id: ${postId}, media: ${mediaId})`);
}

/**
 * Mark a post as failed.
 */
export async function markFailed(postId: number, error: string): Promise<void> {
  await db.table("scheduledPosts").update(postId, {
    status: "failed",
    error,
  });
  logger.error("scheduler", `Post failed (id: ${postId}): ${error}`);
}

/**
 * Check if an alarm name is a scheduled post alarm.
 */
export function isScheduledPostAlarm(alarmName: string): boolean {
  return alarmName.startsWith(ALARM_PREFIX);
}

/**
 * Extract post ID from alarm name.
 */
export function getPostIdFromAlarm(alarmName: string): number {
  return parseInt(alarmName.slice(ALARM_PREFIX.length), 10);
}

/**
 * Re-register alarms for all pending scheduled posts.
 * Call on service worker startup to ensure alarms survive restarts.
 */
export async function reregisterAlarms(): Promise<void> {
  const pending = await getScheduledPosts("scheduled");
  const now = Date.now();

  for (const post of pending) {
    if (!post.id) continue;
    const alarmName = `${ALARM_PREFIX}${post.id}`;

    if (post.scheduledAt <= now) {
      // Overdue - fire immediately
      await chrome.alarms.create(alarmName, { delayInMinutes: 0.5 });
    } else {
      await chrome.alarms.create(alarmName, { when: post.scheduledAt });
    }
  }

  logger.info("scheduler", `Re-registered ${pending.length} post alarms`);
}
