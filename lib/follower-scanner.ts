import { scoreBotProbability, type BotScoreInput, type BotScoreResult } from "./bot-scorer";
import { db, type Prospect } from "../storage/database";
import { logger } from "../utils/logger";

/**
 * Batch bot scanner for followers/prospects.
 * Scans stored prospects and assigns bot scores.
 */

export interface ScanResult {
  total: number;
  scanned: number;
  botsDetected: number;
  averageScore: number;
  scores: Array<{ prospectId: number; username: string; score: number }>;
}

/**
 * Scan queued prospects and compute bot scores.
 * Returns summary stats and individual scores.
 */
export async function scanProspects(
  batchSize = 100,
  threshold = 0.6,
): Promise<ScanResult> {
  const prospects = await db.prospects
    .where("status")
    .equals("queued")
    .limit(batchSize)
    .toArray();

  const scores: ScanResult["scores"] = [];
  let totalScore = 0;
  let botsDetected = 0;

  for (const prospect of prospects) {
    const input = prospectToBotInput(prospect);
    const result = scoreBotProbability(input);
    const id = prospect.id ?? 0;

    scores.push({ prospectId: id, username: prospect.username, score: result.score });
    totalScore += result.score;

    if (result.score >= threshold) {
      botsDetected++;
      // Mark as skipped with bot reason
      if (prospect.id) {
        await db.prospects.update(prospect.id, { status: "skipped" });
      }
      logger.debug(
        "follower-scanner",
        `Bot detected: @${prospect.username} (score: ${result.score.toFixed(2)})`,
      );
    }
  }

  return {
    total: prospects.length,
    scanned: prospects.length,
    botsDetected,
    averageScore: prospects.length > 0 ? totalScore / prospects.length : 0,
    scores,
  };
}

/**
 * Score a single prospect without modifying the database.
 */
export function scoreProspect(prospect: Prospect): BotScoreResult {
  return scoreBotProbability(prospectToBotInput(prospect));
}

function prospectToBotInput(prospect: Prospect): BotScoreInput {
  return {
    username: prospect.username,
    fullName: prospect.fullName,
    hasProfilePic: !!prospect.profilePicUrl && !prospect.profilePicUrl.includes("default"),
    biography: "", // Not stored in Prospect schema - defaults to empty
    postCount: prospect.postCount,
    followerCount: prospect.followerCount,
    followingCount: prospect.followingCount,
    isPrivate: prospect.isPrivate,
    externalUrl: null, // Not stored in Prospect schema
  };
}

/**
 * Get aggregate bot stats for all stored prospects.
 */
export async function getBotStats(): Promise<{
  totalProspects: number;
  averageScore: number;
  distribution: { low: number; medium: number; high: number };
}> {
  const prospects = await db.prospects.toArray();
  if (prospects.length === 0) {
    return { totalProspects: 0, averageScore: 0, distribution: { low: 0, medium: 0, high: 0 } };
  }

  let totalScore = 0;
  const distribution = { low: 0, medium: 0, high: 0 };

  for (const p of prospects) {
    const result = scoreBotProbability(prospectToBotInput(p));
    totalScore += result.score;

    if (result.score < 0.3) {
      distribution.low++;
    } else if (result.score < 0.6) {
      distribution.medium++;
    } else {
      distribution.high++;
    }
  }

  return {
    totalProspects: prospects.length,
    averageScore: totalScore / prospects.length,
    distribution,
  };
}
