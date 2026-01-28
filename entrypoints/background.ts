import { logger } from "../utils/logger";
import { getEngineState, saveEngineState } from "../storage/chrome-storage";

const ALARM_HARVEST = "harvest-tick";
const ALARM_ENGAGE = "engage-tick";
const ALARM_DAILY_RESET = "daily-reset";

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

  switch (alarm.name) {
    case ALARM_HARVEST:
      if (state.state === "idle" || state.state === "harvesting") {
        await handleHarvestTick(state);
      }
      break;
    case ALARM_ENGAGE:
      if (state.state === "idle" || state.state === "engaging") {
        await handleEngageTick(state);
      }
      break;
    case ALARM_DAILY_RESET:
      await handleDailyReset();
      break;
  }
}

async function handleHarvestTick(
  _state: Awaited<ReturnType<typeof getEngineState>>,
) {
  logger.info("background", "Harvest tick — sending to content script");
  // Will be implemented in Phase 3
}

async function handleEngageTick(
  _state: Awaited<ReturnType<typeof getEngineState>>,
) {
  logger.info("background", "Engage tick — sending to content script");
  // Will be implemented in Phase 3
}

async function handleDailyReset() {
  logger.info("background", "Daily reset — clearing counters");
  await saveEngineState({ todayLikes: 0 });
}

function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  const msg = message as { type?: string; payload?: unknown };

  if (!msg.type) {
    sendResponse({ error: "Missing message type" });
    return false;
  }

  logger.debug("background", `Message received: ${msg.type}`);

  switch (msg.type) {
    case "STATUS_REQUEST":
      getEngineState()
        .then((state) => sendResponse({ state }))
        .catch((err: unknown) =>
          sendResponse({ error: String(err) }),
        );
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

    default:
      sendResponse({ error: `Unknown message type: ${msg.type}` });
      return false;
  }
}

async function startEngine() {
  logger.info("background", "Starting engine");
  await saveEngineState({ state: "idle" });

  // Create engagement and harvest alarms
  chrome.alarms.create(ALARM_ENGAGE, { periodInMinutes: 2 });
  chrome.alarms.create(ALARM_HARVEST, { periodInMinutes: 30 });
}

async function stopEngine() {
  logger.info("background", "Stopping engine");
  await saveEngineState({ state: "paused" });

  // Clear engagement alarms
  await chrome.alarms.clear(ALARM_ENGAGE);
  await chrome.alarms.clear(ALARM_HARVEST);
}
