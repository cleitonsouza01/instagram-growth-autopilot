import { db } from "../storage/database";
import { scoreBotProbability } from "./bot-scorer";
import { logger } from "../utils/logger";

/**
 * Export follower/prospect data to CSV or JSON.
 */

export interface ExportRow {
  username: string;
  fullName: string;
  profileUrl: string;
  isPrivate: boolean;
  isVerified: boolean;
  postCount: number;
  followerCount: number;
  followingCount: number;
  botScore: number;
  source: string;
  status: string;
  engagedAt: string | null;
}

/**
 * Export all prospects to CSV.
 */
export async function exportFollowersCSV(): Promise<Blob> {
  const rows = await buildExportRows();

  const headers = [
    "Username",
    "Full Name",
    "Profile URL",
    "Private",
    "Verified",
    "Posts",
    "Followers",
    "Following",
    "Bot Score",
    "Source",
    "Status",
    "Engaged At",
  ];

  const csvLines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.username,
        `"${r.fullName.replace(/"/g, '""')}"`,
        r.profileUrl,
        r.isPrivate,
        r.isVerified,
        r.postCount,
        r.followerCount,
        r.followingCount,
        r.botScore.toFixed(2),
        r.source,
        r.status,
        r.engagedAt ?? "",
      ].join(","),
    ),
  ];

  logger.info("follower-export", `Exported ${rows.length} followers to CSV`);
  return new Blob([csvLines.join("\n")], { type: "text/csv" });
}

/**
 * Export all prospects to JSON.
 */
export async function exportFollowersJSON(): Promise<Blob> {
  const rows = await buildExportRows();
  logger.info("follower-export", `Exported ${rows.length} followers to JSON`);
  return new Blob([JSON.stringify(rows, null, 2)], {
    type: "application/json",
  });
}

/**
 * Trigger download of the export file.
 */
export function downloadExport(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function buildExportRows(): Promise<ExportRow[]> {
  const prospects = await db.prospects.toArray();

  return prospects.map((p) => {
    const botScore = scoreBotProbability({
      username: p.username,
      fullName: p.fullName,
      hasProfilePic: !!p.profilePicUrl && !p.profilePicUrl.includes("default"),
      biography: "",
      postCount: p.postCount,
      followerCount: p.followerCount,
      followingCount: p.followingCount,
      isPrivate: p.isPrivate,
      externalUrl: null,
    });

    return {
      username: p.username,
      fullName: p.fullName,
      profileUrl: `https://www.platform.com/${p.username}/`,
      isPrivate: p.isPrivate,
      isVerified: p.isVerified,
      postCount: p.postCount,
      followerCount: p.followerCount,
      followingCount: p.followingCount,
      botScore: botScore.score,
      source: p.source,
      status: p.status,
      engagedAt: p.engagedAt
        ? new Date(p.engagedAt).toISOString()
        : null,
    };
  });
}
