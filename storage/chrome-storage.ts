import { type UserSettings, DEFAULT_SETTINGS } from "../types/settings";

const SETTINGS_KEY = "userSettings";
const ENGINE_STATE_KEY = "engineState";
const DAILY_COUNTERS_KEY = "dailyCounters";
const CSRF_TOKEN_KEY = "csrfToken";
const HARVEST_PROGRESS_KEY = "harvestProgress";
const CONTENT_SCRIPT_STATE_KEY = "contentScriptState";

export interface DailyCounters {
  date: string; // ISO date (YYYY-MM-DD)
  likes: number;
  follows: number;
  harvests: number;
  prospects: number;
}

export interface PersistedEngineState {
  state: "idle" | "harvesting" | "engaging" | "paused" | "cooldown" | "error";
  todayLikes: number;
  lastAction: number | null;
  cooldownEndsAt: number | null;
  activeCompetitor: string | null;
  harvestCursors: Record<string, string | null>;
}

const DEFAULT_ENGINE_STATE: PersistedEngineState = {
  state: "idle",
  todayLikes: 0,
  lastAction: null,
  cooldownEndsAt: null,
  activeCompetitor: null,
  harvestCursors: {},
};

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<UserSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(
  settings: Partial<UserSettings>,
): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    [SETTINGS_KEY]: { ...current, ...settings },
  });
}

export async function getEngineState(): Promise<PersistedEngineState> {
  const result = await chrome.storage.local.get(ENGINE_STATE_KEY);
  const stored = result[ENGINE_STATE_KEY] as
    | Partial<PersistedEngineState>
    | undefined;
  return { ...DEFAULT_ENGINE_STATE, ...stored };
}

export async function saveEngineState(
  state: Partial<PersistedEngineState>,
): Promise<void> {
  const current = await getEngineState();
  await chrome.storage.local.set({
    [ENGINE_STATE_KEY]: { ...current, ...state },
  });
}

export async function getDailyCounters(): Promise<DailyCounters> {
  const result = await chrome.storage.local.get(DAILY_COUNTERS_KEY);
  const stored = result[DAILY_COUNTERS_KEY] as DailyCounters | undefined;
  const today = todayDateString();

  // Reset if it's a new day
  if (!stored || stored.date !== today) {
    const fresh: DailyCounters = {
      date: today,
      likes: 0,
      follows: 0,
      harvests: 0,
      prospects: 0,
    };
    await chrome.storage.local.set({ [DAILY_COUNTERS_KEY]: fresh });
    return fresh;
  }

  // Ensure follows field exists (migration for existing data)
  if (stored.follows === undefined) {
    stored.follows = 0;
  }

  return stored;
}

export async function incrementDailyCounter(
  key: "likes" | "follows" | "harvests" | "prospects",
  amount = 1,
): Promise<DailyCounters> {
  const counters = await getDailyCounters();
  counters[key] += amount;
  await chrome.storage.local.set({ [DAILY_COUNTERS_KEY]: counters });
  return counters;
}

// =============================================================================
// CSRF Token (synced from content script)
// =============================================================================

export async function getCsrfToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(CSRF_TOKEN_KEY);
  return result[CSRF_TOKEN_KEY] ?? null;
}

export async function setCsrfToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [CSRF_TOKEN_KEY]: token });
}

// =============================================================================
// Background-Orchestrated Harvest Progress
// =============================================================================

export interface HarvestProgress {
  /** Current phase: 'resolving' (getting user IDs) | 'fetching' (getting followers) | 'done' */
  phase: "resolving" | "fetching" | "done";
  /** Competitors to harvest */
  competitors: string[];
  /** Resolved user IDs for each competitor */
  competitorUserIds: Record<string, string>;
  /** Current cursor for each competitor (null = start, empty string = exhausted) */
  cursors: Record<string, string | null>;
  /** How many prospects added per competitor this session */
  prospectCounts: Record<string, number>;
  /** Which competitor is currently being processed */
  currentCompetitorIndex: number;
  /** Pages processed this session */
  pagesProcessed: number;
  /** Max pages allowed */
  maxPages: number;
  /** Timestamp when harvest started */
  startedAt: number;
  /** Timestamp of last progress (updated after each successful step) */
  lastProgressAt: number;
}

export async function getHarvestProgress(): Promise<HarvestProgress | null> {
  const result = await chrome.storage.local.get(HARVEST_PROGRESS_KEY);
  return result[HARVEST_PROGRESS_KEY] ?? null;
}

export async function saveHarvestProgress(
  progress: HarvestProgress | null,
): Promise<void> {
  if (progress === null) {
    await chrome.storage.local.remove(HARVEST_PROGRESS_KEY);
  } else {
    await chrome.storage.local.set({ [HARVEST_PROGRESS_KEY]: progress });
  }
}

export async function clearHarvestProgress(): Promise<void> {
  await chrome.storage.local.remove(HARVEST_PROGRESS_KEY);
}

// =============================================================================
// Content Script State (for detecting active content script across SW restarts)
// =============================================================================

export interface ContentScriptState {
  /** Tab ID of the last active content script */
  tabId: number | null;
  /** Timestamp of the last contact from content script */
  lastContact: number;
  /** URL of the page where content script is running */
  url: string | null;
}

const DEFAULT_CONTENT_SCRIPT_STATE: ContentScriptState = {
  tabId: null,
  lastContact: 0,
  url: null,
};

export async function getContentScriptState(): Promise<ContentScriptState> {
  const result = await chrome.storage.local.get(CONTENT_SCRIPT_STATE_KEY);
  const stored = result[CONTENT_SCRIPT_STATE_KEY] as ContentScriptState | undefined;
  return stored ?? DEFAULT_CONTENT_SCRIPT_STATE;
}

export async function saveContentScriptState(
  state: Partial<ContentScriptState>,
): Promise<void> {
  const current = await getContentScriptState();
  await chrome.storage.local.set({
    [CONTENT_SCRIPT_STATE_KEY]: { ...current, ...state },
  });
}
