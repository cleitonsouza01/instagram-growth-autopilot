import { logger, loadStoredLogs, clearLogs } from "../utils/logger";
import {
  getEngineState,
  saveEngineState,
  getDailyCounters,
  getSettings,
  saveSettings,
  getCsrfToken,
  setCsrfToken,
  getHarvestProgress,
  saveHarvestProgress,
  clearHarvestProgress,
  incrementDailyCounter,
  getContentScriptState,
  saveContentScriptState,
  type PersistedEngineState,
  type HarvestProgress,
} from "../storage/chrome-storage";
import { getTodayStats, getAnalyticsSummary } from "../lib/engagement-analytics";
import { db, type Prospect } from "../storage/database";
import { MessageType } from "../types/messages";
import { HARVEST_DEFAULTS } from "../lib/constants";
import type { FollowerInfo, PaginatedResponse, UserProfile } from "../types/platform";

const ALARM_HARVEST = "harvest-tick";
const ALARM_ENGAGE = "engage-tick";
const ALARM_DAILY_RESET = "daily-reset";

// Timing constants
const HARVEST_INTERVAL_MINUTES = 1; // Check harvest progress every 1 minute
const ENGAGE_INTERVAL_MINUTES = 2;
const STUCK_HARVEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes without progress = stuck

// Track active content script tab (in-memory cache, backed by storage)
let activeContentScriptTabId: number | null = null;
let lastContentScriptContact: number = 0;
const CONTENT_SCRIPT_STALE_MS = 60 * 1000; // Consider stale after 60 seconds

/**
 * Restore content script state from storage on service worker startup.
 * This should be called at the beginning of operations that need to check content script status.
 */
async function restoreContentScriptStateIfNeeded(): Promise<void> {
  // If we already have fresh state, no need to restore
  if (lastContentScriptContact > 0) return;

  const stored = await getContentScriptState();
  if (stored.tabId !== null && stored.lastContact > 0) {
    activeContentScriptTabId = stored.tabId;
    lastContentScriptContact = stored.lastContact;
    logger.debug("background", "Restored content script state from storage", {
      tabId: stored.tabId,
      timeSinceContact: Math.round((Date.now() - stored.lastContact) / 1000) + "s",
    });
  }
}

export default defineBackground(() => {
  // All listeners registered synchronously at top level
  chrome.alarms.onAlarm.addListener(handleAlarm);
  chrome.runtime.onMessage.addListener(handleMessage);
  chrome.runtime.onInstalled.addListener(handleInstall);
  chrome.runtime.onStartup.addListener(handleStartup);

  logger.info("background", "Service worker initialized");
});

function handleInstall(details: chrome.runtime.InstalledDetails) {
  logger.info("background", `Extension installed: ${details.reason}`);
  setupAlarms();
}

function handleStartup() {
  logger.info("background", "Browser started, re-verifying alarms");
  setupAlarms();
}

async function setupAlarms() {
  // Re-create alarms (they may not persist across browser restarts)
  const existing = await chrome.alarms.getAll();
  const existingNames = new Set(existing.map((a) => a.name));

  if (!existingNames.has(ALARM_DAILY_RESET)) {
    // Fire at midnight local time
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    chrome.alarms.create(ALARM_DAILY_RESET, {
      when: midnight.getTime(),
      periodInMinutes: 24 * 60,
    });
  }

  logger.info("background", "Alarms configured", {
    existing: existing.map((a) => a.name),
  });
}

async function handleAlarm(alarm: chrome.alarms.Alarm) {
  // Restore state from storage on every alarm (service worker may have restarted)
  const state = await getEngineState();
  logger.info("background", `Alarm fired: ${alarm.name}`, { state: state.state });

  // Skip if paused or in cooldown
  if (state.state === "paused" || state.state === "cooldown") {
    logger.debug("background", `Skipping alarm - engine is ${state.state}`);
    return;
  }

  switch (alarm.name) {
    case ALARM_HARVEST:
      // Check for stuck harvest state (no progress for 5+ minutes)
      await checkAndResetStuckHarvest();
      await handleHarvestTick(state);
      break;
    case ALARM_ENGAGE:
      // Engagement can run independently of harvest
      // Only skip if we're actively engaging (to prevent overlap)
      logger.info("background", "Engage alarm handler entered", { currentState: state.state });
      if (state.state !== "engaging") {
        try {
          await handleEngageTick(state);
        } catch (err) {
          logger.error("background", "handleEngageTick threw error", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        }
      } else {
        logger.debug("background", "Skipping engage - already engaging");
      }
      break;
    case ALARM_DAILY_RESET:
      await handleDailyReset();
      break;
  }
}

/**
 * Find a tab on the configured platform to send messages to.
 */
async function findPlatformTab(): Promise<chrome.tabs.Tab | null> {
  const settings = await getSettings();
  const baseUrl = settings.platformBaseUrl;
  const tabs = await chrome.tabs.query({ url: `${baseUrl}/*` });
  return tabs.find((t) => t.id !== undefined) ?? null;
}

/**
 * Check if we have a fresh content script connection.
 * Now async to support restoring state from storage after service worker restart.
 */
async function hasActiveContentScript(): Promise<boolean> {
  // Restore from storage if needed (after SW restart)
  await restoreContentScriptStateIfNeeded();

  if (!activeContentScriptTabId) return false;
  const timeSinceContact = Date.now() - lastContentScriptContact;
  return timeSinceContact < CONTENT_SCRIPT_STALE_MS;
}

/**
 * Send a message to the content script on platform.com.
 * Returns the response or null if no tab found.
 */
async function sendToContentScript<T = unknown>(
  type: string,
  payload: unknown = {},
): Promise<T | null> {
  logger.debug("background", "sendToContentScript called", { type, cachedTabId: activeContentScriptTabId });

  // First try the cached tab ID
  let tabId = activeContentScriptTabId;

  // Check if we've heard from content script recently
  if (tabId !== null) {
    logger.debug("background", "Checking content script freshness", { tabId });
    const isActive = await hasActiveContentScript();
    if (!isActive) {
      logger.debug("background", "Content script connection stale, looking for new tab");
      tabId = null;
    }
  }

  // Verify the tab still exists and is on the platform
  if (tabId !== null) {
    logger.debug("background", "Verifying tab exists", { tabId });
    try {
      const tab = await chrome.tabs.get(tabId);
      const settings = await getSettings();
      if (!tab.url?.startsWith(settings.platformBaseUrl)) {
        logger.debug("background", "Tab URL doesn't match platform", { url: tab.url });
        tabId = null;
      }
    } catch (err) {
      logger.debug("background", "Tab verification failed", { error: String(err) });
      tabId = null;
    }
  }

  // If cached tab is gone, find a new one
  if (tabId === null) {
    logger.debug("background", "Looking for new platform tab");
    const tab = await findPlatformTab();
    if (!tab || !tab.id) {
      logger.debug("background", "No platform tab found");
      return null;
    }
    tabId = tab.id;
    activeContentScriptTabId = tabId;
    logger.debug("background", "Found new platform tab", { tabId });
  }

  logger.info("background", "Sending message to content script", { type, tabId });

  try {
    logger.debug("background", "Calling chrome.tabs.sendMessage", { type, tabId });

    // Add timeout to prevent hanging forever if content script doesn't respond
    const timeoutMs = 30000; // 30 seconds
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { type, payload }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error(`Message timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    logger.debug("background", "chrome.tabs.sendMessage completed", { type });
    // Update last contact on successful communication
    const now = Date.now();
    lastContentScriptContact = now;
    // Persist to storage (fire and forget)
    saveContentScriptState({ lastContact: now }).catch(() => {});
    logger.debug("background", "Content script response received", { type, response });
    return response as T;
  } catch (err) {
    logger.error(
      "background",
      "Failed to send message to content script",
      { error: err instanceof Error ? err.message : String(err) },
    );
    // Clear cached tab ID since communication failed
    activeContentScriptTabId = null;
    // Also clear from storage
    saveContentScriptState({ tabId: null, lastContact: 0, url: null }).catch(() => {});
    return null;
  }
}

// =============================================================================
// Background-Orchestrated Harvest
// =============================================================================

async function handleHarvestTick(state: PersistedEngineState): Promise<void> {
  logger.info("background", "Harvest tick - checking harvest state");

  // Re-read state in case engagement started since alarm fired
  const currentState = await getEngineState();
  if (currentState.state === "engaging") {
    logger.debug("background", "Engagement in progress, deferring harvest");
    return;
  }

  // Check if we have a CSRF token
  const csrfToken = await getCsrfToken();
  if (!csrfToken) {
    logger.warn("background", "No CSRF token available - need content script to provide one");
    // Try to find a platform tab - content script should send CSRF when it loads
    const tab = await findPlatformTab();
    if (!tab) {
      logger.warn("background", "No platform tab found for CSRF token");
    }
    return;
  }

  // Check if we have a content script available
  if (!(await hasActiveContentScript())) {
    logger.debug("background", "No active content script, skipping harvest tick");
    return;
  }

  const settings = await getSettings();

  // Check if we have competitors configured
  if (settings.competitors.length === 0) {
    logger.info("background", "No competitors configured, skipping harvest");
    return;
  }

  // Check or create harvest progress
  let progress = await getHarvestProgress();
  if (!progress) {
    // Start new harvest session
    const now = Date.now();
    progress = {
      phase: "resolving",
      competitors: settings.competitors,
      competitorUserIds: {},
      cursors: state.harvestCursors ?? {},
      prospectCounts: {},
      currentCompetitorIndex: 0,
      pagesProcessed: 0,
      maxPages: HARVEST_DEFAULTS.maxPagesPerSession,
      startedAt: now,
      lastProgressAt: now,
    };
    await saveHarvestProgress(progress);
    await saveEngineState({ state: "harvesting" });
    logger.info("background", "Starting new harvest session", {
      competitors: progress.competitors,
    });
  }

  // Process one step
  await processHarvestStep(progress);
}

async function processHarvestStep(progress: HarvestProgress): Promise<void> {
  // Check if we've hit the max pages limit
  if (progress.pagesProcessed >= progress.maxPages) {
    logger.info("background", "Harvest complete: max pages reached", {
      pagesProcessed: progress.pagesProcessed,
    });
    await finishHarvest(progress);
    return;
  }

  // Phase 1: Resolve competitor usernames to user IDs
  if (progress.phase === "resolving") {
    for (const competitor of progress.competitors) {
      if (progress.competitorUserIds[competitor]) {
        continue; // Already resolved
      }

      logger.info("background", `Resolving user ID for @${competitor}`);

      const response = await sendToContentScript<{
        success: boolean;
        data?: UserProfile;
        error?: string;
      }>(MessageType.API_FETCH_USER, { username: competitor });

      if (!response) {
        logger.warn("background", "No content script available for API call");
        return; // Will retry on next tick
      }

      if (!response.success || !response.data) {
        logger.error("background", `Failed to resolve @${competitor}`, {
          error: response.error,
        });
        // Mark as resolved with empty to skip
        progress.competitorUserIds[competitor] = "";
      } else {
        progress.competitorUserIds[competitor] = response.data.pk;
        logger.info("background", `Resolved @${competitor} -> ${response.data.pk}`);
      }

      // Save progress after each resolution
      progress.lastProgressAt = Date.now();
      await saveHarvestProgress(progress);

      // Add delay between API calls
      await delay(2000 + Math.random() * 1000);
    }

    // All resolved, move to fetching phase
    progress.phase = "fetching";
    await saveHarvestProgress(progress);
  }

  // Phase 2: Fetch followers from each competitor (round-robin)
  if (progress.phase === "fetching") {
    const competitors = progress.competitors.filter(
      (c) => progress.competitorUserIds[c] && progress.competitorUserIds[c] !== "",
    );

    if (competitors.length === 0) {
      logger.warn("background", "No valid competitors to fetch from");
      await finishHarvest(progress);
      return;
    }

    // Find next competitor to fetch from
    let processed = false;
    for (let i = 0; i < competitors.length && !processed; i++) {
      const idx = (progress.currentCompetitorIndex + i) % competitors.length;
      const competitor = competitors[idx];
      const userId = progress.competitorUserIds[competitor];
      const cursor = progress.cursors[competitor];

      // Skip if exhausted (empty string cursor means done)
      if (cursor === "") {
        continue;
      }

      // Skip if hit per-competitor limit
      const count = progress.prospectCounts[competitor] ?? 0;
      if (count >= HARVEST_DEFAULTS.maxProspectsPerCompetitor) {
        continue;
      }

      logger.info("background", `Fetching followers page for @${competitor}`, {
        userId,
        cursor: cursor ?? "first_page",
      });

      const response = await sendToContentScript<{
        success: boolean;
        data?: PaginatedResponse<FollowerInfo>;
        error?: string;
      }>(MessageType.API_FETCH_FOLLOWERS, {
        userId,
        cursor: cursor ?? undefined,
        count: HARVEST_DEFAULTS.followersPerPage,
        type: "followers",
      });

      if (!response) {
        logger.warn("background", "No content script available for followers fetch");
        return; // Will retry on next tick
      }

      if (!response.success || !response.data) {
        logger.error("background", `Failed to fetch followers for @${competitor}`, {
          error: response.error,
        });
        // Mark as exhausted
        progress.cursors[competitor] = "";
      } else {
        // Process the fetched followers
        const newProspects = await processFollowersPage(
          response.data.items,
          competitor,
        );

        progress.cursors[competitor] = response.data.next_max_id ?? "";
        progress.prospectCounts[competitor] =
          (progress.prospectCounts[competitor] ?? 0) + newProspects;
        progress.pagesProcessed++;

        logger.info("background", `Page complete for @${competitor}`, {
          newProspects,
          total: progress.prospectCounts[competitor],
          hasMore: response.data.has_more,
        });

        if (newProspects > 0) {
          await incrementDailyCounter("prospects", newProspects);
        }
      }

      // Move to next competitor
      progress.currentCompetitorIndex = (idx + 1) % competitors.length;
      progress.lastProgressAt = Date.now();
      await saveHarvestProgress(progress);
      processed = true;

      // Delay before next action
      await delay(HARVEST_DEFAULTS.pageFetchDelayMs);
    }

    // If no competitor made progress, we're done
    if (!processed) {
      logger.info("background", "All competitors exhausted or at limit");
      await finishHarvest(progress);
    }
  }
}

async function processFollowersPage(
  followers: FollowerInfo[],
  source: string,
): Promise<number> {
  let newProspects = 0;

  for (const follower of followers) {
    // Check for duplicates
    const existing = await db.prospects
      .where("platformUserId")
      .equals(follower.pk)
      .first();

    if (existing) {
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
      postCount: 0,
      followerCount: 0,
      followingCount: 0,
      source,
      fetchedAt: Date.now(),
      engagedAt: null,
      status: "queued",
    };

    await db.prospects.add(prospect);
    newProspects++;
  }

  return newProspects;
}

async function finishHarvest(progress: HarvestProgress): Promise<void> {
  // Calculate totals
  const totalNew = Object.values(progress.prospectCounts).reduce((a, b) => a + b, 0);

  // Save final cursors to engine state
  await saveEngineState({
    state: "idle",
    harvestCursors: progress.cursors,
  });

  // Increment harvest counter
  await incrementDailyCounter("harvests", 1);

  // Clear progress
  await clearHarvestProgress();

  logger.info("background", "Harvest session complete", {
    totalNew,
    pagesProcessed: progress.pagesProcessed,
    duration: Date.now() - progress.startedAt,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if harvest is stuck (no progress for STUCK_HARVEST_TIMEOUT_MS).
 * If stuck, reset state to idle and clear progress.
 */
async function checkAndResetStuckHarvest(): Promise<void> {
  const progress = await getHarvestProgress();
  if (!progress) return;

  const timeSinceLastProgress = Date.now() - progress.lastProgressAt;

  // If no progress for more than the timeout, harvest is stuck
  if (timeSinceLastProgress > STUCK_HARVEST_TIMEOUT_MS) {
    logger.warn("background", "Harvest appears stuck, resetting", {
      timeSinceLastProgress: Math.round(timeSinceLastProgress / 1000) + "s",
      pagesProcessed: progress.pagesProcessed,
      phase: progress.phase,
    });

    // Save what we have (cursors) and reset
    await saveEngineState({
      state: "idle",
      harvestCursors: progress.cursors,
    });
    await clearHarvestProgress();
  }
}

// =============================================================================
// Engagement Handling (fully orchestrated in background)
// =============================================================================

/**
 * Check if current time is within active hours.
 */
function isWithinActiveHours(startHour: number, endHour: number): boolean {
  const currentHour = new Date().getHours();
  if (startHour <= endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }
  // Handle overnight range (e.g., 22 to 6)
  return currentHour >= startHour || currentHour < endHour;
}

async function handleEngageTick(state: PersistedEngineState): Promise<void> {
  logger.info("background", "handleEngageTick START");

  // Check if already engaging
  if (state.state === "engaging") {
    logger.debug("background", "Already engaging, skipping");
    return;
  }

  // Check if we have an active content script
  const hasActive = await hasActiveContentScript();
  if (!hasActive) {
    logger.debug("background", "No active content script, skipping engagement tick");
    return;
  }

  // Get settings and counters
  const settings = await getSettings();
  const counters = await getDailyCounters();

  logger.info("background", "Engagement check", {
    todayLikes: counters.likes,
    dailyLimit: settings.dailyLikeLimit,
    activeHours: `${settings.activeHoursStart}:00 - ${settings.activeHoursEnd}:00`,
    currentHour: new Date().getHours(),
  });

  // Guard: outside active hours
  if (!isWithinActiveHours(settings.activeHoursStart, settings.activeHoursEnd)) {
    logger.info("background", "Outside active hours, skipping engagement");
    return;
  }

  // Guard: daily limit reached
  if (counters.likes >= settings.dailyLikeLimit) {
    logger.info("background", `Daily like limit reached (${counters.likes}/${settings.dailyLikeLimit})`);
    return;
  }

  // Update state to engaging
  await saveEngineState({ state: "engaging" });

  try {
    // Get next prospect from queue (background has correct DB access)
    const prospect = await db.prospects
      .where("status")
      .equals("queued")
      .sortBy("fetchedAt")
      .then((prospects) => prospects[0] ?? null);

    if (!prospect || !prospect.id) {
      logger.info("background", "No prospects in queue");
      await saveEngineState({ state: "idle" });
      return;
    }

    logger.info("background", `Processing prospect: @${prospect.username}`, {
      prospectId: prospect.id,
      platformUserId: prospect.platformUserId,
    });

    // Fetch fresh profile to get accurate data
    const profileResponse = await sendToContentScript<{
      success: boolean;
      data?: UserProfile;
      error?: string;
    }>(MessageType.API_FETCH_USER, { userId: prospect.platformUserId });

    if (!profileResponse) {
      logger.warn("background", "No content script available for profile fetch");
      await saveEngineState({ state: "idle" });
      return;
    }

    if (profileResponse.success && profileResponse.data) {
      // Update prospect with fresh data
      const profile = profileResponse.data;
      await db.prospects.update(prospect.id, {
        postCount: profile.media_count ?? 0,
        followerCount: profile.follower_count ?? 0,
        followingCount: profile.following_count ?? 0,
        isPrivate: profile.is_private ?? prospect.isPrivate,
        isVerified: profile.is_verified ?? prospect.isVerified,
      });
      prospect.postCount = profile.media_count ?? 0;
      prospect.isPrivate = profile.is_private ?? prospect.isPrivate;
      prospect.isVerified = profile.is_verified ?? prospect.isVerified;

      logger.debug("background", `Updated @${prospect.username} profile`, {
        postCount: prospect.postCount,
        isPrivate: prospect.isPrivate,
      });
    }

    // Apply filters
    if (settings.skipPrivateAccounts && prospect.isPrivate) {
      logger.info("background", `Skipped @${prospect.username}: private account`);
      await db.prospects.update(prospect.id, { status: "skipped" });
      await saveEngineState({ state: "idle" });
      return;
    }

    if (settings.skipVerifiedAccounts && prospect.isVerified) {
      logger.info("background", `Skipped @${prospect.username}: verified account`);
      await db.prospects.update(prospect.id, { status: "skipped" });
      await saveEngineState({ state: "idle" });
      return;
    }

    if (prospect.postCount < settings.minPostCount) {
      logger.info("background", `Skipped @${prospect.username}: low post count (${prospect.postCount} < ${settings.minPostCount})`);
      await db.prospects.update(prospect.id, { status: "skipped" });
      await saveEngineState({ state: "idle" });
      return;
    }

    // Fetch user's media to find posts to like
    const mediaResponse = await sendToContentScript<{
      success: boolean;
      data?: { items: Array<{ id: string; pk: string }> };
      error?: string;
    }>(MessageType.API_GET_USER_MEDIA, { userId: prospect.platformUserId, count: settings.likesPerProspect + 2 });

    if (!mediaResponse || !mediaResponse.success || !mediaResponse.data) {
      logger.warn("background", `Failed to fetch media for @${prospect.username}`, {
        error: mediaResponse?.error,
      });
      await db.prospects.update(prospect.id, { status: "failed" });
      await saveEngineState({ state: "idle" });
      return;
    }

    const posts = mediaResponse.data.items;
    if (posts.length === 0) {
      logger.info("background", `No posts found for @${prospect.username}`);
      await db.prospects.update(prospect.id, { status: "skipped" });
      await saveEngineState({ state: "idle" });
      return;
    }

    // Like posts (up to likesPerProspect)
    let likesPerformed = 0;
    const postsToLike = posts.slice(0, settings.likesPerProspect);

    for (const post of postsToLike) {
      // Add delay between likes
      if (likesPerformed > 0) {
        const delayMs = (settings.minDelaySeconds + Math.random() * (settings.maxDelaySeconds - settings.minDelaySeconds)) * 1000;
        logger.debug("background", `Waiting ${Math.round(delayMs / 1000)}s before next like`);
        await delay(delayMs);
      }

      const likeResponse = await sendToContentScript<{
        success: boolean;
        error?: string;
      }>(MessageType.API_LIKE_POST, { mediaId: post.pk || post.id });

      if (likeResponse?.success) {
        likesPerformed++;
        logger.info("background", `Liked post ${post.pk || post.id} for @${prospect.username}`);

        // Log the action
        await db.actionLogs.add({
          action: "like",
          targetUserId: prospect.platformUserId,
          targetUsername: prospect.username,
          mediaId: post.pk || post.id,
          success: true,
          timestamp: Date.now(),
        });
      } else {
        logger.warn("background", `Failed to like post ${post.pk || post.id}`, {
          error: likeResponse?.error,
        });
      }
    }

    // Update like counters
    if (likesPerformed > 0) {
      await incrementDailyCounter("likes", likesPerformed);
    }

    // Follow user if enabled
    let followed = false;
    logger.info("background", "Follow check", {
      followEnabled: settings.followEnabled,
      prospectUsername: prospect.username,
      prospectUserId: prospect.platformUserId,
    });

    if (settings.followEnabled) {
      logger.info("background", "Following is enabled, proceeding with follow");

      // Add delay before follow
      if (likesPerformed > 0) {
        const delayMs = (settings.minDelaySeconds + Math.random() * (settings.maxDelaySeconds - settings.minDelaySeconds)) * 1000;
        logger.info("background", `Waiting ${Math.round(delayMs / 1000)}s before follow`);
        await delay(delayMs);
      }

      logger.info("background", `Sending follow request for @${prospect.username} (${prospect.platformUserId})`);

      const followResponse = await sendToContentScript<{
        success: boolean;
        data?: { following?: boolean };
        error?: string;
      }>(MessageType.API_FOLLOW_USER, { userId: prospect.platformUserId });

      logger.info("background", "Follow response received", {
        response: followResponse,
        success: followResponse?.success,
        error: followResponse?.error,
      });

      if (followResponse?.success) {
        followed = true;
        await incrementDailyCounter("follows", 1);
        logger.info("background", `Successfully followed @${prospect.username}`);

        // Log the action
        await db.actionLogs.add({
          action: "follow" as const,
          targetUserId: prospect.platformUserId,
          targetUsername: prospect.username,
          success: true,
          timestamp: Date.now(),
        });
      } else {
        logger.warn("background", `Failed to follow @${prospect.username}`, {
          error: followResponse?.error,
          fullResponse: followResponse,
        });
      }
    } else {
      logger.info("background", "Following is disabled, skipping follow");
    }

    // Update prospect status
    if (likesPerformed > 0 || followed) {
      await db.prospects.update(prospect.id, {
        status: "engaged",
        engagedAt: Date.now(),
      });
      logger.info("background", `Engagement complete for @${prospect.username}`, {
        likes: likesPerformed,
        followed,
      });
    } else {
      await db.prospects.update(prospect.id, { status: "failed" });
      logger.warn("background", `Engagement failed: no actions performed for @${prospect.username}`);
    }

  } catch (err) {
    logger.error("background", "Engagement error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Always reset to idle after engagement attempt
  await saveEngineState({ state: "idle" });
}

async function handleDailyReset() {
  logger.info("background", "Daily reset - clearing counters");
  await saveEngineState({ todayLikes: 0 });
}

// =============================================================================
// Message Handling
// =============================================================================

function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  const msg = message as { type?: string; payload?: Record<string, unknown> };

  if (!msg.type) {
    sendResponse({ error: "Missing message type" });
    return false;
  }

  // Don't log GET_LOGS, CLEAR_LOGS, or CSRF token updates to avoid polluting logs
  if (msg.type !== "GET_LOGS" && msg.type !== "CLEAR_LOGS" && msg.type !== MessageType.SET_CSRF_TOKEN) {
    logger.debug("background", `Message received: ${msg.type}`);
  }

  switch (msg.type) {
    case MessageType.SET_CSRF_TOKEN:
      handleSetCsrfToken(msg.payload ?? {}, sender, sendResponse);
      return true;

    case MessageType.CONTENT_SCRIPT_READY:
      handleContentScriptReady(sender, sendResponse);
      return true;

    case "STATUS_REQUEST":
      handleStatusRequest(sendResponse);
      return true; // async response

    case "ENGAGEMENT_START":
      startEngine()
        .then(() => sendResponse({ success: true }))
        .catch((err: unknown) =>
          sendResponse({ error: String(err) }),
        );
      return true;

    case "ENGAGEMENT_STOP":
      stopEngine()
        .then(() => sendResponse({ success: true }))
        .catch((err: unknown) =>
          sendResponse({ error: String(err) }),
        );
      return true;

    case "ANALYTICS_TODAY":
      Promise.all([getTodayStats(), getAnalyticsSummary("7d")])
        .then(([todayStats, summary]) =>
          sendResponse({
            todayStats,
            analytics: {
              conversionRate: summary.conversionRate,
              netGrowth: summary.netGrowth,
            },
          }),
        )
        .catch((err: unknown) =>
          sendResponse({ error: String(err) }),
        );
      return true;

    case "ACTIVITY_LOG":
      Promise.all([
        getEngineState(),
        getDailyCounters(),
        db.actionLogs
          .orderBy("timestamp")
          .reverse()
          .limit(50)
          .toArray(),
        db.prospects
          .where("status")
          .equals("queued")
          .count(),
        db.prospects
          .where("status")
          .equals("engaged")
          .count(),
        db.prospects
          .where("status")
          .equals("skipped")
          .count(),
      ])
        .then(([engineState, counters, recentLogs, queued, engaged, skipped]) =>
          sendResponse({
            engineState,
            counters,
            recentLogs,
            queueStats: { queued, engaged, skipped },
          }),
        )
        .catch((err: unknown) =>
          sendResponse({ error: String(err) }),
        );
      return true;

    case "GET_LOGS":
      loadStoredLogs()
        .then((logs) => sendResponse({ logs }))
        .catch((err: unknown) =>
          sendResponse({ error: String(err) }),
        );
      return true;

    case "CLEAR_LOGS":
      clearLogs()
        .then(() => sendResponse({ success: true }))
        .catch((err: unknown) =>
          sendResponse({ error: String(err) }),
        );
      return true;

    case MessageType.LOG_ACTION:
      handleLogAction(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.ADD_COMPETITOR:
      handleAddCompetitor(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.REMOVE_COMPETITOR:
      handleRemoveCompetitor(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.GET_COMPETITORS:
      getSettings()
        .then((settings) => sendResponse({ competitors: settings.competitors }))
        .catch((err: unknown) => sendResponse({ error: String(err) }));
      return true;

    case MessageType.ADD_TARGET_PROFILE:
      handleAddTargetProfile(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.REMOVE_TARGET_PROFILE:
      handleRemoveTargetProfile(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.GET_TARGET_PROFILES:
      getSettings()
        .then((settings) => sendResponse({ targetProfiles: settings.targetProfiles }))
        .catch((err: unknown) => sendResponse({ error: String(err) }));
      return true;

    case MessageType.GET_SETTINGS:
      getSettings()
        .then((settings) => sendResponse({ settings }))
        .catch((err: unknown) => sendResponse({ error: String(err) }));
      return true;

    case MessageType.UPDATE_SETTINGS:
      handleUpdateSettings(msg.payload ?? {}, sendResponse);
      return true;

    default:
      sendResponse({ error: `Unknown message type: ${msg.type}` });
      return false;
  }
}

function handleSetCsrfToken(
  payload: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): void {
  const csrfToken = payload.csrfToken as string | undefined;

  if (!csrfToken) {
    sendResponse({ success: false, error: "Missing csrfToken" });
    return;
  }

  // Track the tab that sent this token and update last contact time
  const now = Date.now();
  if (sender.tab?.id) {
    activeContentScriptTabId = sender.tab.id;
    lastContentScriptContact = now;

    // Persist to storage so state survives SW restart
    saveContentScriptState({
      tabId: sender.tab.id,
      lastContact: now,
      url: sender.tab.url ?? null,
    }).catch((err) => {
      logger.warn("background", "Failed to persist content script state", { error: String(err) });
    });
  }

  setCsrfToken(csrfToken)
    .then(() => {
      // Don't log every keepalive, too noisy
      sendResponse({ success: true });
    })
    .catch((err) => {
      sendResponse({ success: false, error: String(err) });
    });
}

/**
 * Handle LOG_ACTION message from content script.
 * Writes action logs to IndexedDB in the extension's origin.
 */
function handleLogAction(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): void {
  const actionLog = {
    action: payload.action as "like" | "unlike" | "harvest" | "filter",
    targetUserId: payload.targetUserId as string,
    targetUsername: payload.targetUsername as string,
    mediaId: payload.mediaId as string | undefined,
    success: payload.success as boolean,
    error: payload.error as string | undefined,
    timestamp: payload.timestamp as number,
  };

  db.actionLogs
    .add(actionLog)
    .then(() => {
      sendResponse({ success: true });
    })
    .catch((err) => {
      logger.error("background", "Failed to log action", { error: String(err) });
      sendResponse({ success: false, error: String(err) });
    });
}

function handleContentScriptReady(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): void {
  const now = Date.now();
  if (sender.tab?.id) {
    activeContentScriptTabId = sender.tab.id;
    lastContentScriptContact = now;
    logger.info("background", "Content script ready", {
      tabId: sender.tab.id,
      url: sender.tab.url,
    });

    // Persist to storage so state survives SW restart
    saveContentScriptState({
      tabId: sender.tab.id,
      lastContact: now,
      url: sender.tab.url ?? null,
    }).catch((err) => {
      logger.warn("background", "Failed to persist content script state", { error: String(err) });
    });
  }

  // Check if we have a harvest in progress that can be resumed
  getHarvestProgress().then((progress) => {
    if (progress) {
      logger.info("background", "Resuming interrupted harvest", {
        phase: progress.phase,
        pagesProcessed: progress.pagesProcessed,
      });
      // Schedule immediate harvest tick to resume
      chrome.alarms.create(ALARM_HARVEST, { delayInMinutes: 0.1 });
    }
  });

  sendResponse({ success: true });
}

// =============================================================================
// Competitor Management
// =============================================================================

async function handleAddCompetitor(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const username = payload.username as string | undefined;

  if (!username) {
    sendResponse({ success: false, error: "Missing username" });
    return;
  }

  // Normalize username (remove @ if present, lowercase)
  const normalized = username.replace(/^@/, "").toLowerCase().trim();

  if (!normalized) {
    sendResponse({ success: false, error: "Invalid username" });
    return;
  }

  try {
    const settings = await getSettings();

    // Check if already exists
    if (settings.competitors.includes(normalized)) {
      sendResponse({ success: true, alreadyExists: true, competitors: settings.competitors });
      return;
    }

    // Add to list
    const updated = [...settings.competitors, normalized];
    await saveSettings({ competitors: updated });

    logger.info("background", "Competitor added", { username: normalized, total: updated.length });
    sendResponse({ success: true, competitors: updated });
  } catch (err) {
    logger.error("background", "Failed to add competitor", { error: String(err) });
    sendResponse({ success: false, error: String(err) });
  }
}

async function handleRemoveCompetitor(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const username = payload.username as string | undefined;

  if (!username) {
    sendResponse({ success: false, error: "Missing username" });
    return;
  }

  const normalized = username.replace(/^@/, "").toLowerCase().trim();

  try {
    const settings = await getSettings();
    const updated = settings.competitors.filter((c) => c !== normalized);
    await saveSettings({ competitors: updated });

    logger.info("background", "Competitor removed", { username: normalized, total: updated.length });
    sendResponse({ success: true, competitors: updated });
  } catch (err) {
    logger.error("background", "Failed to remove competitor", { error: String(err) });
    sendResponse({ success: false, error: String(err) });
  }
}

// =============================================================================
// Target Profile Management
// =============================================================================

async function handleAddTargetProfile(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const username = payload.username as string | undefined;

  if (!username) {
    sendResponse({ success: false, error: "Missing username" });
    return;
  }

  const normalized = username.replace(/^@/, "").toLowerCase().trim();

  if (!normalized) {
    sendResponse({ success: false, error: "Invalid username" });
    return;
  }

  try {
    const settings = await getSettings();
    const targetProfiles = settings.targetProfiles ?? [];

    if (targetProfiles.includes(normalized)) {
      sendResponse({ success: true, alreadyExists: true, targetProfiles });
      return;
    }

    const updated = [...targetProfiles, normalized];
    await saveSettings({ targetProfiles: updated });

    logger.info("background", "Target profile added", { username: normalized, total: updated.length });
    sendResponse({ success: true, targetProfiles: updated });
  } catch (err) {
    logger.error("background", "Failed to add target profile", { error: String(err) });
    sendResponse({ success: false, error: String(err) });
  }
}

async function handleRemoveTargetProfile(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const username = payload.username as string | undefined;

  if (!username) {
    sendResponse({ success: false, error: "Missing username" });
    return;
  }

  const normalized = username.replace(/^@/, "").toLowerCase().trim();

  try {
    const settings = await getSettings();
    const targetProfiles = settings.targetProfiles ?? [];
    const updated = targetProfiles.filter((p) => p !== normalized);
    await saveSettings({ targetProfiles: updated });

    logger.info("background", "Target profile removed", { username: normalized, total: updated.length });
    sendResponse({ success: true, targetProfiles: updated });
  } catch (err) {
    logger.error("background", "Failed to remove target profile", { error: String(err) });
    sendResponse({ success: false, error: String(err) });
  }
}

async function handleUpdateSettings(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    const updates = payload.settings as Partial<Record<string, unknown>> | undefined;

    if (!updates || typeof updates !== "object") {
      sendResponse({ success: false, error: "Invalid settings object" });
      return;
    }

    await saveSettings(updates);
    const newSettings = await getSettings();

    logger.info("background", "Settings updated", { keys: Object.keys(updates) });
    sendResponse({ success: true, settings: newSettings });
  } catch (err) {
    logger.error("background", "Failed to update settings", { error: String(err) });
    sendResponse({ success: false, error: String(err) });
  }
}

// =============================================================================
// Engine Control
// =============================================================================

async function startEngine() {
  logger.info("background", "Starting engine");

  const settings = await getSettings();

  // Check prerequisites
  if (!settings.platformBaseUrl) {
    logger.error("background", "Cannot start: No platform URL configured");
    return;
  }

  if (settings.competitors.length === 0) {
    logger.warn("background", "Starting engine with no competitors configured - harvest will be skipped");
  }

  logger.info("background", "Engine configuration", {
    platformUrl: settings.platformBaseUrl,
    competitors: settings.competitors.length,
    dailyLimit: settings.dailyLikeLimit,
  });

  await saveEngineState({ state: "idle" });

  // Create engagement and harvest alarms
  // Stagger start times to avoid both firing at the same instant
  // Engage starts at 30s, harvest starts at 45s
  chrome.alarms.create(ALARM_ENGAGE, { delayInMinutes: 0.5, periodInMinutes: ENGAGE_INTERVAL_MINUTES });
  chrome.alarms.create(ALARM_HARVEST, { delayInMinutes: 0.75, periodInMinutes: HARVEST_INTERVAL_MINUTES });

  logger.info("background", "Alarms scheduled", {
    engage: `first in 30s, then every ${ENGAGE_INTERVAL_MINUTES}m`,
    harvest: `first in 30s, then every ${HARVEST_INTERVAL_MINUTES}m`,
  });

  // Also trigger an immediate check to see if we can find the platform tab
  const tab = await findPlatformTab();
  if (tab && tab.id) {
    activeContentScriptTabId = tab.id;
    // Set a recent timestamp so hasActiveContentScript passes initially
    // Content script keepalive will update this with real timestamps
    lastContentScriptContact = Date.now();
    await saveContentScriptState({
      tabId: tab.id,
      lastContact: Date.now(),
      url: tab.url ?? null,
    });
    logger.info("background", "Platform tab found and registered", { tabId: tab.id, url: tab.url });

    // Warmup: Send a simple ping to initialize the messaging channel
    // This prevents the first real message from hanging
    try {
      logger.debug("background", "Sending warmup ping to content script");
      await chrome.tabs.sendMessage(tab.id, { type: "PING" });
      logger.debug("background", "Warmup ping completed");
    } catch (err) {
      logger.debug("background", "Warmup ping failed (content script may not be ready)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    logger.warn("background", "No platform tab found - open the platform website to enable engagement");
  }
}

async function stopEngine() {
  logger.info("background", "Stopping engine");
  await saveEngineState({ state: "paused" });

  // Clear any in-progress harvest
  await clearHarvestProgress();

  // Clear engagement alarms
  await chrome.alarms.clear(ALARM_ENGAGE);
  await chrome.alarms.clear(ALARM_HARVEST);
}

// =============================================================================
// Detailed Status Request
// =============================================================================

async function handleStatusRequest(
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    const [engineState, counters, harvestProgress, queueDepth, settings] = await Promise.all([
      getEngineState(),
      getDailyCounters(),
      getHarvestProgress(),
      db.prospects.where("status").equals("queued").count(),
      getSettings(),
    ]);

    // Determine current task based on state and progress
    let currentTask: string | undefined;
    if (engineState.state === "harvesting" && harvestProgress) {
      if (harvestProgress.phase === "resolving") {
        const resolved = Object.keys(harvestProgress.competitorUserIds).length;
        currentTask = `Resolving usernames (${resolved}/${harvestProgress.competitors.length})`;
      } else {
        const current = harvestProgress.competitors[harvestProgress.currentCompetitorIndex];
        currentTask = `Fetching @${current} (page ${harvestProgress.pagesProcessed + 1})`;
      }
    } else if (engineState.state === "engaging") {
      currentTask = "Processing engagement queue...";
    }

    const state = {
      state: engineState.state,
      todayLikes: counters.likes || 0,
      todayFollows: counters.follows || 0,
      queueDepth,
      currentTask,
      harvestProgress: harvestProgress ? {
        phase: harvestProgress.phase,
        pagesProcessed: harvestProgress.pagesProcessed,
        maxPages: harvestProgress.maxPages,
        competitors: harvestProgress.competitors.length,
      } : null,
      // Debug: include setting values
      debugSettings: {
        followEnabled: settings.followEnabled,
        likesEnabled: settings.likesEnabled,
      },
    };

    sendResponse({ state });
  } catch (err) {
    sendResponse({ error: String(err) });
  }
}
