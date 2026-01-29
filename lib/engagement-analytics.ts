import { db } from "../storage/database";
import type { ActionLog, DailySnapshot, Prospect } from "../storage/database";
import { logger } from "../utils/logger";

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "all";

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  totalLikes: number;
  totalProspectsEngaged: number;
  newFollowers: number;
  lostFollowers: number;
  netGrowth: number;
  conversionRate: number;
  likesPerFollow: number;
  dailyGrowthRate: number;
  bestCompetitors: Array<{ username: string; conversionRate: number; engaged: number }>;
  bestHours: Array<{ hour: number; actions: number; successRate: number }>;
  actionBreakdown: {
    successful: number;
    failed: number;
    blocked: number;
  };
}

function periodToDays(period: AnalyticsPeriod): number {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return 365 * 10; // Effectively all data
  }
}

function getTimeCutoff(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

/**
 * Compute a full analytics summary for the given period.
 */
export async function getAnalyticsSummary(
  period: AnalyticsPeriod,
): Promise<AnalyticsSummary> {
  const days = periodToDays(period);
  const cutoff = getTimeCutoff(days);
  const dateCutoff = new Date(cutoff).toISOString().slice(0, 10);

  // Fetch action logs for the period
  const actions = await db.actionLogs
    .where("timestamp")
    .aboveOrEqual(cutoff)
    .toArray();

  // Fetch daily snapshots for the period
  const snapshots = await db.dailySnapshots
    .where("date")
    .aboveOrEqual(dateCutoff)
    .sortBy("date");

  // Fetch engaged prospects for the period
  const engagedProspects = await db.prospects
    .where("status")
    .equals("engaged")
    .toArray();
  const periodProspects = engagedProspects.filter(
    (p) => p.engagedAt && p.engagedAt >= cutoff,
  );

  // Basic counts
  const likeActions = actions.filter((a) => a.action === "like");
  const successfulLikes = likeActions.filter((a) => a.success);
  const failedLikes = likeActions.filter((a) => !a.success);
  const blockedLikes = failedLikes.filter(
    (a) => a.error?.includes("blocked") || a.error?.includes("spam"),
  );

  const totalLikes = successfulLikes.length;
  const totalProspectsEngaged = periodProspects.length;

  // Growth from snapshots
  const newFollowers = snapshots.reduce(
    (sum, s) => sum + s.newFollowers.length,
    0,
  );
  const lostFollowers = snapshots.reduce(
    (sum, s) => sum + s.lostFollowers.length,
    0,
  );
  const netGrowth = snapshots.reduce((sum, s) => sum + s.netGrowth, 0);

  // Conversion rate
  const conversionRate =
    totalProspectsEngaged > 0 ? newFollowers / totalProspectsEngaged : 0;

  // Likes per follow
  const likesPerFollow = newFollowers > 0 ? totalLikes / newFollowers : 0;

  // Daily growth rate
  const actualDays = Math.max(1, snapshots.length);
  const dailyGrowthRate = netGrowth / actualDays;

  // Best competitors
  const bestCompetitors = computeBestCompetitors(periodProspects, snapshots);

  // Best hours
  const bestHours = computeBestHours(actions);

  // Action breakdown
  const actionBreakdown = {
    successful: successfulLikes.length,
    failed: failedLikes.length - blockedLikes.length,
    blocked: blockedLikes.length,
  };

  logger.debug("engagement-analytics", `Summary computed for ${period}`, {
    totalLikes,
    totalProspectsEngaged,
    netGrowth,
    conversionRate,
  });

  return {
    period,
    totalLikes,
    totalProspectsEngaged,
    newFollowers,
    lostFollowers,
    netGrowth,
    conversionRate,
    likesPerFollow,
    dailyGrowthRate,
    bestCompetitors,
    bestHours,
    actionBreakdown,
  };
}

/**
 * Compute which competitor sources produce the best conversion rates.
 */
function computeBestCompetitors(
  prospects: Prospect[],
  _snapshots: DailySnapshot[],
): Array<{ username: string; conversionRate: number; engaged: number }> {
  const competitorMap = new Map<string, { engaged: number; followed: number }>();

  for (const p of prospects) {
    const entry = competitorMap.get(p.source) ?? { engaged: 0, followed: 0 };
    entry.engaged++;
    competitorMap.set(p.source, entry);
  }

  return Array.from(competitorMap.entries())
    .map(([username, data]) => ({
      username,
      conversionRate: data.engaged > 0 ? data.followed / data.engaged : 0,
      engaged: data.engaged,
    }))
    .sort((a, b) => b.engaged - a.engaged);
}

/**
 * Compute engagement success rates by hour of day.
 */
function computeBestHours(
  actions: ActionLog[],
): Array<{ hour: number; actions: number; successRate: number }> {
  const hourMap = new Map<number, { total: number; successful: number }>();

  // Initialize all 24 hours
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { total: 0, successful: 0 });
  }

  for (const action of actions) {
    if (action.action !== "like") continue;
    const hour = new Date(action.timestamp).getHours();
    const entry = hourMap.get(hour)!;
    entry.total++;
    if (action.success) entry.successful++;
  }

  return Array.from(hourMap.entries())
    .map(([hour, data]) => ({
      hour,
      actions: data.total,
      successRate: data.total > 0 ? data.successful / data.total : 0,
    }))
    .sort((a, b) => b.actions - a.actions);
}

/**
 * Get a quick summary of today's activity for the popup.
 */
export async function getTodayStats(): Promise<{
  likesToday: number;
  prospectsEngaged: number;
  queueDepth: number;
  successRate: number;
}> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayActions = await db.actionLogs
    .where("timestamp")
    .aboveOrEqual(todayStart.getTime())
    .toArray();

  const likeActions = todayActions.filter((a) => a.action === "like");
  const successfulLikes = likeActions.filter((a) => a.success);
  const uniqueProspects = new Set(
    successfulLikes.map((a) => a.targetUserId),
  ).size;

  const queueDepth = await db.prospects
    .where("status")
    .equals("queued")
    .count();

  return {
    likesToday: successfulLikes.length,
    prospectsEngaged: uniqueProspects,
    queueDepth,
    successRate:
      likeActions.length > 0
        ? successfulLikes.length / likeActions.length
        : 1,
  };
}
