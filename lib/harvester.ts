import { getUserByUsername } from "../api/endpoints/user";
import { getFollowers } from "../api/endpoints/followers";
import { db, type Prospect } from "../storage/database";
import { delay } from "../utils/delay";
import { logger } from "../utils/logger";
import { HARVEST_DEFAULTS } from "./constants";

export interface HarvestConfig {
  competitors: string[];
  maxProspectsPerCompetitor: number;
  pageFetchDelayMs: number;
  maxPagesPerSession: number;
}

export interface HarvestResult {
  competitorUsername: string;
  newProspects: number;
  duplicatesSkipped: number;
  pagesProcessed: number;
  cursor: string | null;
}

/**
 * Harvest followers from competitor accounts.
 * Rotates through competitors, fetching one page at a time from each
 * before moving to the next competitor.
 */
export async function harvestCompetitorFollowers(
  config: Partial<HarvestConfig> & { competitors: string[] },
  onProgress: (result: HarvestResult) => void,
  signal: AbortSignal,
  /** Resume cursors from previous session, keyed by competitor username */
  cursors: Record<string, string | null> = {},
): Promise<HarvestResult[]> {
  const cfg: HarvestConfig = {
    maxProspectsPerCompetitor: HARVEST_DEFAULTS.maxProspectsPerCompetitor,
    pageFetchDelayMs: HARVEST_DEFAULTS.pageFetchDelayMs,
    maxPagesPerSession: HARVEST_DEFAULTS.maxPagesPerSession,
    ...config,
  };

  logger.info("harvester", "Starting harvest", {
    competitors: cfg.competitors,
    maxPagesPerSession: cfg.maxPagesPerSession,
    cursors,
  });

  const results: HarvestResult[] = [];
  const competitorCursors = { ...cursors };
  const competitorProspectCounts: Record<string, number> = {};

  // Track per-competitor new prospect counts
  for (const c of cfg.competitors) {
    competitorProspectCounts[c] = 0;
  }

  // Round-robin: process one page from each competitor, then repeat
  let totalPages = 0;

  for (
    let round = 0;
    round < cfg.maxPagesPerSession && !signal.aborted;
    round++
  ) {
    let anyProgress = false;

    for (const competitor of cfg.competitors) {
      if (signal.aborted) break;

      // Skip if we've hit the per-competitor limit
      const count = competitorProspectCounts[competitor] ?? 0;
      if (count >= cfg.maxProspectsPerCompetitor) {
        continue;
      }

      // Skip if no more pages for this competitor
      if (competitorCursors[competitor] === "") {
        continue;
      }

      try {
        const result = await harvestOnePage(
          competitor,
          competitorCursors[competitor] ?? undefined,
          signal,
        );

        competitorCursors[competitor] = result.cursor ?? "";
        competitorProspectCounts[competitor] =
          (competitorProspectCounts[competitor] ?? 0) + result.newProspects;

        totalPages++;
        anyProgress = true;

        onProgress(result);

        // Update or add to results
        const existing = results.find(
          (r) => r.competitorUsername === competitor,
        );
        if (existing) {
          existing.newProspects += result.newProspects;
          existing.duplicatesSkipped += result.duplicatesSkipped;
          existing.pagesProcessed += result.pagesProcessed;
          existing.cursor = result.cursor;
        } else {
          results.push({ ...result });
        }

        // Delay between page fetches
        if (!signal.aborted) {
          await delay(cfg.pageFetchDelayMs);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        logger.error("harvester", `Error harvesting ${competitor}`, {
          error: errorMsg,
          stack: errorStack,
        });
        // Mark this competitor as done to avoid retrying in this session
        competitorCursors[competitor] = "";
      }
    }

    // If no competitor made progress, stop
    if (!anyProgress) {
      logger.info("harvester", "No progress made in round, stopping harvest");
      break;
    }

    // Check total pages limit
    if (totalPages >= cfg.maxPagesPerSession) {
      logger.info("harvester", "Max pages reached, stopping harvest");
      break;
    }
  }

  logger.info("harvester", "Harvest complete", {
    totalPages,
    results: results.map(r => ({
      competitor: r.competitorUsername,
      new: r.newProspects,
      dupes: r.duplicatesSkipped,
    })),
  });

  return results;
}

/**
 * Fetch one page of followers for a competitor and store as prospects.
 */
async function harvestOnePage(
  competitorUsername: string,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<HarvestResult> {
  logger.info(
    "harvester",
    `Fetching followers page for @${competitorUsername}`,
    { cursor: cursor ?? "first_page" },
  );

  // Resolve username to user ID
  const userProfile = await getUserByUsername(competitorUsername, signal);
  const userId = userProfile.pk;

  // Fetch one page of followers
  const page = await getFollowers(
    userId,
    cursor,
    HARVEST_DEFAULTS.followersPerPage,
    signal,
  );

  let newProspects = 0;
  let duplicatesSkipped = 0;

  for (const follower of page.items) {
    // Check for duplicates
    const existing = await db.prospects
      .where("platformUserId")
      .equals(follower.pk)
      .first();

    if (existing) {
      duplicatesSkipped++;
      continue;
    }

    // Create new prospect
    const prospect: Omit<Prospect, "id"> = {
      platformUserId: follower.pk,
      username: follower.username,
      fullName: follower.full_name,
      profilePicUrl: follower.profile_pic_url,
      isPrivate: follower.is_private,
      isVerified: follower.is_verified,
      postCount: 0, // Will be populated during filtering/engagement
      followerCount: 0,
      followingCount: 0,
      source: competitorUsername,
      fetchedAt: Date.now(),
      engagedAt: null,
      status: "queued",
    };

    await db.prospects.add(prospect);
    newProspects++;
  }

  logger.info(
    "harvester",
    `Page complete for @${competitorUsername}: ${newProspects} new, ${duplicatesSkipped} dupes`,
  );

  return {
    competitorUsername,
    newProspects,
    duplicatesSkipped,
    pagesProcessed: 1,
    cursor: page.next_max_id,
  };
}
