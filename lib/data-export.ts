import { db } from "../storage/database";
import { logger } from "../utils/logger";

/**
 * Export follower history as CSV or JSON.
 */
export async function exportFollowerHistory(
  format: "csv" | "json",
): Promise<Blob> {
  const snapshots = await db.dailySnapshots.orderBy("date").toArray();

  if (format === "json") {
    return new Blob([JSON.stringify(snapshots, null, 2)], {
      type: "application/json",
    });
  }

  const header = "date,followerCount,followingCount,postCount,netGrowth,likesToday,prospectsEngaged,newFollowers,lostFollowers";
  const rows = snapshots.map((s) =>
    [
      s.date,
      s.followerCount,
      s.followingCount,
      s.postCount,
      s.netGrowth,
      s.likesToday,
      s.prospectsEngaged,
      s.newFollowers.length,
      s.lostFollowers.length,
    ].join(","),
  );

  const csv = [header, ...rows].join("\n");
  return new Blob([csv], { type: "text/csv" });
}

/**
 * Export action logs as CSV or JSON.
 */
export async function exportActionLogs(
  format: "csv" | "json",
): Promise<Blob> {
  const logs = await db.actionLogs.orderBy("timestamp").toArray();

  if (format === "json") {
    return new Blob([JSON.stringify(logs, null, 2)], {
      type: "application/json",
    });
  }

  const header = "id,action,targetUserId,targetUsername,mediaId,success,error,timestamp,date";
  const rows = logs.map((l) =>
    [
      l.id,
      l.action,
      l.targetUserId,
      l.targetUsername,
      l.mediaId ?? "",
      l.success,
      l.error ?? "",
      l.timestamp,
      new Date(l.timestamp).toISOString(),
    ].join(","),
  );

  const csv = [header, ...rows].join("\n");
  return new Blob([csv], { type: "text/csv" });
}

/**
 * Export prospects as CSV or JSON.
 */
export async function exportProspects(
  format: "csv" | "json",
): Promise<Blob> {
  const prospects = await db.prospects.toArray();

  if (format === "json") {
    return new Blob([JSON.stringify(prospects, null, 2)], {
      type: "application/json",
    });
  }

  const header = "id,platformUserId,username,fullName,isPrivate,isVerified,postCount,followerCount,followingCount,source,status,fetchedAt,engagedAt";
  const rows = prospects.map((p) =>
    [
      p.id,
      p.platformUserId,
      p.username,
      `"${p.fullName.replace(/"/g, '""')}"`,
      p.isPrivate,
      p.isVerified,
      p.postCount,
      p.followerCount,
      p.followingCount,
      p.source,
      p.status,
      new Date(p.fetchedAt).toISOString(),
      p.engagedAt ? new Date(p.engagedAt).toISOString() : "",
    ].join(","),
  );

  const csv = [header, ...rows].join("\n");
  return new Blob([csv], { type: "text/csv" });
}

/**
 * Trigger a file download in the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  logger.info("data-export", `Downloaded ${filename} (${blob.size} bytes)`);
}
