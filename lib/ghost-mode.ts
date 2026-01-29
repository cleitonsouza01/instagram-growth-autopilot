import { logger } from "../utils/logger";

/**
 * Ghost mode - block story "seen" reporting.
 * Uses chrome.declarativeNetRequest to intercept and block the
 * story seen API call before it reaches the platform.
 */

const GHOST_MODE_RULE_ID = 1001;
const STORAGE_KEY = "ghostModeEnabled";

/**
 * Enable ghost mode - blocks story "seen" reporting.
 */
export async function enableGhostMode(): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: GHOST_MODE_RULE_ID,
        priority: 1,
        action: { type: "block" as chrome.declarativeNetRequest.RuleActionType },
        condition: {
          urlFilter: "*/api/v1/media/*/seen*",
          domains: ["www.platform.com"],
          resourceTypes: ["xmlhttprequest" as chrome.declarativeNetRequest.ResourceType],
        },
      },
    ],
    removeRuleIds: [GHOST_MODE_RULE_ID],
  });

  await chrome.storage.local.set({ [STORAGE_KEY]: true });
  logger.info("ghost-mode", "Ghost mode enabled - story views will not be reported");
}

/**
 * Disable ghost mode - re-allows story "seen" reporting.
 */
export async function disableGhostMode(): Promise<void> {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [GHOST_MODE_RULE_ID],
    addRules: [],
  });

  await chrome.storage.local.set({ [STORAGE_KEY]: false });
  logger.info("ghost-mode", "Ghost mode disabled - story views will be reported normally");
}

/**
 * Check if ghost mode is currently enabled.
 */
export async function isGhostModeEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] === true;
}

/**
 * Toggle ghost mode.
 */
export async function toggleGhostMode(): Promise<boolean> {
  const enabled = await isGhostModeEnabled();
  if (enabled) {
    await disableGhostMode();
  } else {
    await enableGhostMode();
  }
  return !enabled;
}

/**
 * Restore ghost mode state on startup.
 * Call from the service worker onStartup listener.
 */
export async function restoreGhostModeState(): Promise<void> {
  const enabled = await isGhostModeEnabled();
  if (enabled) {
    await enableGhostMode();
    logger.info("ghost-mode", "Ghost mode restored on startup");
  }
}
