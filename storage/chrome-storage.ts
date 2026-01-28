import { type UserSettings, DEFAULT_SETTINGS } from "../types/settings";

const SETTINGS_KEY = "userSettings";
const ENGINE_STATE_KEY = "engineState";
const DAILY_COUNTERS_KEY = "dailyCounters";

export interface DailyCounters {
  date: string; // ISO date (YYYY-MM-DD)
  likes: number;
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
      harvests: 0,
      prospects: 0,
    };
    await chrome.storage.local.set({ [DAILY_COUNTERS_KEY]: fresh });
    return fresh;
  }

  return stored;
}

export async function incrementDailyCounter(
  key: "likes" | "harvests" | "prospects",
  amount = 1,
): Promise<DailyCounters> {
  const counters = await getDailyCounters();
  counters[key] += amount;
  await chrome.storage.local.set({ [DAILY_COUNTERS_KEY]: counters });
  return counters;
}
