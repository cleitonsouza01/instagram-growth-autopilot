import { db, type Prospect } from "../storage/database";
import { logger } from "../utils/logger";

/**
 * Get the next prospect in FIFO order (by fetchedAt) with status "queued".
 */
export async function getNextProspect(): Promise<Prospect | null> {
  // Debug: Log total counts by status
  const stats = await getQueueStats();
  const total = await db.prospects.count();
  logger.info("engagement-queue", "getNextProspect - DB stats", {
    total,
    queued: stats.queued,
    engaged: stats.engaged,
    failed: stats.failed,
    skipped: stats.skipped,
  });

  const prospects = await db.prospects
    .where("status")
    .equals("queued")
    .sortBy("fetchedAt");

  logger.info("engagement-queue", `Found ${prospects.length} queued prospects`);

  return prospects[0] ?? null;
}

/**
 * Mark a prospect as engaged (success or failure).
 */
export async function markEngaged(
  prospectId: number,
  success: boolean,
  error?: string,
): Promise<void> {
  if (success) {
    await db.prospects.update(prospectId, {
      status: "engaged",
      engagedAt: Date.now(),
    });
    logger.info("engagement-queue", `Prospect ${prospectId} marked as engaged`);
  } else {
    await db.prospects.update(prospectId, {
      status: "failed",
    });
    logger.warn(
      "engagement-queue",
      `Prospect ${prospectId} marked as failed: ${error ?? "unknown"}`,
    );
  }
}

/**
 * Mark a prospect as skipped (filtered out).
 */
export async function markSkipped(
  prospectId: number,
  reason: string,
): Promise<void> {
  await db.prospects.update(prospectId, {
    status: "skipped",
  });
  logger.debug(
    "engagement-queue",
    `Prospect ${prospectId} skipped: ${reason}`,
  );
}

/**
 * Get queue statistics.
 */
export async function getQueueStats(): Promise<{
  queued: number;
  engaged: number;
  failed: number;
  skipped: number;
}> {
  const [queued, engaged, failed, skipped] = await Promise.all([
    db.prospects.where("status").equals("queued").count(),
    db.prospects.where("status").equals("engaged").count(),
    db.prospects.where("status").equals("failed").count(),
    db.prospects.where("status").equals("skipped").count(),
  ]);

  return { queued, engaged, failed, skipped };
}
