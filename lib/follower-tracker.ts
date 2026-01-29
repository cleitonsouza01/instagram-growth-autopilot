import { db, type DailySnapshot } from "../storage/database";
import { logger } from "../utils/logger";

/**
 * Take a daily snapshot of follower/following counts.
 * Compares with the previous snapshot to detect new followers and unfollowers.
 *
 * In a real scenario, this would call the platform API to get current counts.
 * For now, it accepts the data as parameters (the orchestrator provides it).
 */
export async function takeSnapshot(data: {
  followerCount: number;
  followingCount: number;
  postCount: number;
  currentFollowerUsernames?: string[];
}): Promise<DailySnapshot> {
  const today = new Date().toISOString().slice(0, 10);

  // Check if we already have a snapshot for today
  const existing = await db.dailySnapshots
    .where("date")
    .equals(today)
    .first();

  if (existing) {
    logger.info("follower-tracker", `Snapshot already exists for ${today}`);
    return existing;
  }

  // Get previous snapshot for comparison
  const previousSnapshots = await db.dailySnapshots
    .orderBy("date")
    .reverse()
    .limit(1)
    .toArray();
  const previous = previousSnapshots[0];

  // Calculate new/lost followers if we have username lists
  let newFollowers: string[] = [];
  let lostFollowers: string[] = [];

  if (data.currentFollowerUsernames && previous) {
    // For now, we compare counts since full follower lists are expensive to fetch
    // The full list comparison will be implemented when the follower fetch pipeline runs
    const prevCount = previous.followerCount;
    const gained = Math.max(0, data.followerCount - prevCount);
    const lost = Math.max(0, prevCount - data.followerCount + gained);

    // We'll have proper username-level tracking once the daily follower fetch runs
    newFollowers = data.currentFollowerUsernames.slice(0, gained);
    lostFollowers = [];

    // If we have lost followers from the previous snapshot's follower list
    if (gained === 0 && lost > 0) {
      lostFollowers = [`~${lost} unfollowers detected`];
    }
  }

  const netGrowth = data.followerCount - (previous?.followerCount ?? data.followerCount);

  // Count today's actions from the action logs
  const todayStart = new Date(today).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;

  const todayActions = await db.actionLogs
    .where("timestamp")
    .between(todayStart, todayEnd)
    .toArray();

  const likesToday = todayActions.filter(
    (a) => a.action === "like" && a.success,
  ).length;

  const prospectsEngaged = new Set(
    todayActions
      .filter((a) => a.action === "like" && a.success)
      .map((a) => a.targetUserId),
  ).size;

  const snapshot: Omit<DailySnapshot, "id"> = {
    date: today,
    followerCount: data.followerCount,
    followingCount: data.followingCount,
    postCount: data.postCount,
    newFollowers,
    lostFollowers,
    netGrowth,
    likesToday,
    prospectsEngaged,
  };

  await db.dailySnapshots.add(snapshot);
  logger.info("follower-tracker", `Snapshot saved for ${today}`, {
    followers: data.followerCount,
    netGrowth,
    likesToday,
  });

  return { ...snapshot, id: undefined } as DailySnapshot;
}

/**
 * Get growth history for the last N days.
 */
export async function getGrowthHistory(
  days: number,
): Promise<DailySnapshot[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return db.dailySnapshots
    .where("date")
    .aboveOrEqual(cutoffDate)
    .sortBy("date");
}

/**
 * Get the list of unfollowers detected over the last N days.
 */
export async function getUnfollowers(days: number): Promise<string[]> {
  const history = await getGrowthHistory(days);
  const unfollowers: string[] = [];

  for (const snapshot of history) {
    unfollowers.push(...snapshot.lostFollowers);
  }

  return unfollowers;
}
