import { logger } from "../utils/logger";
import { executeEngagementCycle } from "../lib/orchestrator";
import { harvestCompetitorFollowers, type HarvestResult } from "../lib/harvester";
import { saveEngineState, incrementDailyCounter } from "../storage/chrome-storage";
import { MessageType } from "../types/messages";
import { extractCsrfFromDocument } from "../api/csrf";
import { getUserByUsername, getUserById } from "../api/endpoints/user";
import { getFollowers, getFollowing, followUser } from "../api/endpoints/followers";
import { getUserFeed, likeMedia } from "../api/endpoints/media";
import { injectControlPanel } from "./content/ControlPanel";
import { initProfileButtons } from "./content/ProfileButtons";
import { injectSettingsModal } from "./content/SettingsModal";

// Keepalive interval (30 seconds)
const KEEPALIVE_INTERVAL_MS = 30 * 1000;
let keepaliveIntervalId: ReturnType<typeof setInterval> | null = null;

export default defineContentScript({
  matches: ["https://www.instagram.com/*"],
  runAt: "document_idle",

  main() {
    logger.info("content", "Content script injected on platform");

    // Extract and send CSRF token to background immediately
    syncCsrfToken();

    // Listen for messages from the service worker
    chrome.runtime.onMessage.addListener(handleMessage);

    // Notify background that content script is ready
    chrome.runtime.sendMessage({
      type: MessageType.CONTENT_SCRIPT_READY,
      payload: { url: window.location.href },
    }).catch(() => {
      // Background might not be ready yet, that's ok
    });

    // Start periodic keepalive to re-sync CSRF token and notify background we're still alive
    startKeepalive();

    // Inject the floating control panel UI
    injectControlPanel();

    // Inject "+" buttons next to profile names
    initProfileButtons();

    // Inject the settings modal
    injectSettingsModal();

    // Clean up on page unload
    window.addEventListener("beforeunload", () => {
      if (keepaliveIntervalId) {
        clearInterval(keepaliveIntervalId);
        keepaliveIntervalId = null;
      }
    });
  },
});

/**
 * Start periodic keepalive signal to background.
 * This ensures the background knows we're still alive and has fresh CSRF token.
 */
function startKeepalive(): void {
  if (keepaliveIntervalId) {
    clearInterval(keepaliveIntervalId);
  }

  keepaliveIntervalId = setInterval(() => {
    // Re-sync CSRF token (it might have changed)
    syncCsrfToken();
  }, KEEPALIVE_INTERVAL_MS);
}

/**
 * Extract CSRF token from cookies and send to background.
 * Called on injection and can be called again if token expires.
 */
function syncCsrfToken(): void {
  const csrfToken = extractCsrfFromDocument();
  if (csrfToken) {
    logger.debug("content", "Sending CSRF token to background");
    chrome.runtime.sendMessage({
      type: MessageType.SET_CSRF_TOKEN,
      payload: { csrfToken },
    }).catch((err) => {
      logger.warn("content", "Failed to send CSRF token", { error: String(err) });
    });
  } else {
    logger.warn("content", "No CSRF token found in cookies - user may not be logged in");
  }
}

// AbortController for cancelling in-progress operations
let currentAbortController: AbortController | null = null;

function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  const msg = message as { type?: string; payload?: Record<string, unknown> };

  if (!msg.type) {
    return false;
  }

  // Log all messages except high-frequency API calls
  const isAtomicApiCall = msg.type.startsWith("API_");
  if (!isAtomicApiCall) {
    logger.info("content", `Message received: ${msg.type}`);
  }

  switch (msg.type) {
    // Simple ping for warmup/health check
    case "PING":
      sendResponse({ pong: true });
      return false;

    // Legacy harvest (full orchestration in content script)
    case MessageType.HARVEST_START:
      handleHarvestStart(msg.payload ?? {}, sendResponse);
      return true; // async response

    case MessageType.ENGAGE_PROSPECT:
      handleEngageProspect(sendResponse);
      return true; // async response

    case MessageType.ENGAGEMENT_STOP:
      // Abort any in-progress operation
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      sendResponse({ success: true });
      return false;

    // Atomic API operations - single request, immediate response
    case MessageType.API_FETCH_USER:
      handleApiFetchUser(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.API_FETCH_FOLLOWERS:
      handleApiFetchFollowers(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.API_GET_USER_MEDIA:
      handleApiGetUserMedia(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.API_LIKE_POST:
      handleApiLikePost(msg.payload ?? {}, sendResponse);
      return true;

    case MessageType.API_FOLLOW_USER:
      handleApiFollowUser(msg.payload ?? {}, sendResponse);
      return true;

    default:
      return false;
  }
}

// =============================================================================
// Atomic API Handlers - Each handles a single API request
// =============================================================================

async function handleApiFetchUser(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const username = payload.username as string | undefined;
  const userId = payload.userId as string | undefined;

  try {
    let user;
    if (username) {
      user = await getUserByUsername(username);
    } else if (userId) {
      user = await getUserById(userId);
    } else {
      sendResponse({ success: false, error: "Missing username or userId" });
      return;
    }
    sendResponse({ success: true, data: user });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn("content", "API_FETCH_USER failed", { error: errorMsg, username, userId });
    sendResponse({ success: false, error: errorMsg });
  }
}

async function handleApiFetchFollowers(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const userId = payload.userId as string;
  const cursor = payload.cursor as string | undefined;
  const count = (payload.count as number) ?? 50;
  const type = (payload.type as "followers" | "following") ?? "followers";

  if (!userId) {
    sendResponse({ success: false, error: "Missing userId" });
    return;
  }

  try {
    const result = type === "following"
      ? await getFollowing(userId, cursor, count)
      : await getFollowers(userId, cursor, count);

    logger.debug("content", `API_FETCH_FOLLOWERS complete`, {
      userId,
      type,
      itemsCount: result.items.length,
      hasMore: result.has_more,
    });

    sendResponse({ success: true, data: result });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn("content", "API_FETCH_FOLLOWERS failed", { error: errorMsg, userId });
    sendResponse({ success: false, error: errorMsg });
  }
}

async function handleApiGetUserMedia(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const userId = payload.userId as string;
  const count = (payload.count as number) ?? 12;

  if (!userId) {
    sendResponse({ success: false, error: "Missing userId" });
    return;
  }

  try {
    const result = await getUserFeed(userId, count);
    sendResponse({ success: true, data: result });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn("content", "API_GET_USER_MEDIA failed", { error: errorMsg, userId });
    sendResponse({ success: false, error: errorMsg });
  }
}

async function handleApiLikePost(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const mediaId = payload.mediaId as string;

  if (!mediaId) {
    sendResponse({ success: false, error: "Missing mediaId" });
    return;
  }

  try {
    await likeMedia(mediaId);
    sendResponse({ success: true });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn("content", "API_LIKE_POST failed", { error: errorMsg, mediaId });
    sendResponse({ success: false, error: errorMsg });
  }
}

async function handleApiFollowUser(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  const userId = payload.userId as string;

  if (!userId) {
    sendResponse({ success: false, error: "Missing userId" });
    return;
  }

  try {
    const result = await followUser(userId);
    logger.info("content", `Followed user ${userId}`, { following: result?.following });
    sendResponse({ success: true, data: result });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn("content", "API_FOLLOW_USER failed", { error: errorMsg, userId });
    sendResponse({ success: false, error: errorMsg });
  }
}

// =============================================================================
// Legacy Handlers - Full orchestration in content script (to be migrated)
// =============================================================================

async function handleHarvestStart(
  payload: Record<string, unknown>,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  logger.info("content", "handleHarvestStart called", { payload });

  const competitors = (payload.competitors as string[]) ?? [];
  const cursors = (payload.cursors as Record<string, string | null>) ?? {};

  logger.info("content", "Parsed harvest params", { competitors, cursors });

  if (competitors.length === 0) {
    sendResponse({ success: false, error: "No competitors configured" });
    await saveEngineState({ state: "idle" });
    return;
  }

  // Create abort controller for this operation
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  try {
    logger.info("content", `Starting harvest for ${competitors.length} competitors`, {
      competitors,
    });

    const results = await harvestCompetitorFollowers(
      { competitors },
      (result: HarvestResult) => {
        logger.debug("content", `Harvest progress: @${result.competitorUsername}`, {
          newProspects: result.newProspects,
        });
      },
      signal,
      cursors,
    );

    // Calculate totals
    const totalNew = results.reduce((sum, r) => sum + r.newProspects, 0);
    const newCursors: Record<string, string | null> = {};
    for (const r of results) {
      newCursors[r.competitorUsername] = r.cursor;
    }

    // Update counters
    if (totalNew > 0) {
      await incrementDailyCounter("prospects", totalNew);
      await incrementDailyCounter("harvests", 1);
    }

    // Save cursors for next session and return to idle
    await saveEngineState({
      state: "idle",
      harvestCursors: newCursors,
    });

    logger.info("content", `Harvest complete: ${totalNew} new prospects`);
    sendResponse({ success: true, totalNew });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    logger.error("content", "Harvest failed", { error: errorMsg, stack: errorStack });
    await saveEngineState({ state: "idle" });
    sendResponse({ success: false, error: errorMsg });
  } finally {
    currentAbortController = null;
  }
}

async function handleEngageProspect(
  sendResponse: (response: unknown) => void,
): Promise<void> {
  logger.info("content", "handleEngageProspect called");

  // Create abort controller for this operation
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  try {
    logger.info("content", "Starting engagement cycle");

    const performed = await executeEngagementCycle(signal);

    logger.info("content", `Engagement cycle complete, performed: ${performed}`);
    sendResponse({ success: true, performed });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("content", "Engagement failed", errorMsg);

    // Don't override state here — orchestrator handles state transitions
    sendResponse({ success: false, error: errorMsg });
  } finally {
    currentAbortController = null;
  }
}
