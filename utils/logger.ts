export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: string;
}

const LOG_PREFIX = "[GA-Autopilot]";
const MAX_STORED_LOGS = 500;
const LOGS_STORAGE_KEY = "engineLogs";

// In-memory log buffer (local to this context)
let logBuffer: LogEntry[] = [];

// Use a random base to make IDs unique across contexts (background vs content)
// Each context gets a different random range to avoid collisions
const idBase = Math.floor(Math.random() * 1000000000);
let logIdCounter = idBase;

// Track IDs we've already persisted to avoid duplicates
const persistedIds = new Set<number>();

/**
 * Persist logs to chrome.storage.local.
 * Merges with existing logs from other contexts (background/content).
 */
async function persistLogs(): Promise<void> {
  try {
    // Load existing logs from storage (may include logs from other contexts)
    const result = await chrome.storage.local.get(LOGS_STORAGE_KEY);
    const existingLogs = (result[LOGS_STORAGE_KEY] as LogEntry[] | undefined) ?? [];

    // Get new logs that haven't been persisted yet
    const newLogs = logBuffer.filter((log) => !persistedIds.has(log.id));

    // Mark these as persisted
    for (const log of newLogs) {
      persistedIds.add(log.id);
    }

    // Merge: existing logs + new logs, sorted by timestamp, deduped by id
    const allLogs = [...existingLogs, ...newLogs];
    const seenIds = new Set<number>();
    const dedupedLogs = allLogs.filter((log) => {
      if (seenIds.has(log.id)) return false;
      seenIds.add(log.id);
      return true;
    });

    // Sort by timestamp and keep only the last MAX_STORED_LOGS
    dedupedLogs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const logsToStore = dedupedLogs.slice(-MAX_STORED_LOGS);

    await chrome.storage.local.set({ [LOGS_STORAGE_KEY]: logsToStore });
  } catch {
    // Storage might not be available in all contexts
  }
}

/**
 * Load logs from chrome.storage.local.
 * Returns all logs (merged from all contexts).
 */
export async function loadStoredLogs(): Promise<LogEntry[]> {
  try {
    const result = await chrome.storage.local.get(LOGS_STORAGE_KEY);
    const stored = result[LOGS_STORAGE_KEY] as LogEntry[] | undefined;
    if (stored && Array.isArray(stored)) {
      // Sort by timestamp for consistent display
      return stored.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
  } catch {
    // Storage might not be available
  }
  return [];
}

/**
 * Get all logs from buffer
 */
export function getLogs(): LogEntry[] {
  return [...logBuffer];
}

/**
 * Clear all logs
 */
export async function clearLogs(): Promise<void> {
  logBuffer = [];
  logIdCounter = idBase; // Reset to base, not 0
  persistedIds.clear(); // Clear the persisted IDs set
  try {
    await chrome.storage.local.remove(LOGS_STORAGE_KEY);
  } catch {
    // Storage might not be available
  }
}

/**
 * Format logs for export/copy
 */
export function formatLogsForExport(logs: LogEntry[]): string {
  return logs
    .map((log) => {
      const dataStr = log.data ? ` ${log.data}` : "";
      return `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.context}] ${log.message}${dataStr}`;
    })
    .join("\n");
}

function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: unknown,
): void {
  const timestamp = new Date().toISOString();
  const formatted = `${LOG_PREFIX} [${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;

  // Console output
  switch (level) {
    case "debug":
      console.debug(formatted, data ?? "");
      break;
    case "info":
      console.info(formatted, data ?? "");
      break;
    case "warn":
      console.warn(formatted, data ?? "");
      break;
    case "error":
      console.error(formatted, data ?? "");
      break;
  }

  // Store in buffer
  const entry: LogEntry = {
    id: logIdCounter++,
    timestamp,
    level,
    context,
    message,
    data: data !== undefined ? JSON.stringify(data) : undefined,
  };

  logBuffer.push(entry);

  // Trim buffer if too large
  if (logBuffer.length > MAX_STORED_LOGS) {
    logBuffer = logBuffer.slice(-MAX_STORED_LOGS);
  }

  // Persist asynchronously (don't await to avoid blocking)
  persistLogs();
}

export const logger = {
  debug: (ctx: string, msg: string, data?: unknown) =>
    log("debug", ctx, msg, data),
  info: (ctx: string, msg: string, data?: unknown) =>
    log("info", ctx, msg, data),
  warn: (ctx: string, msg: string, data?: unknown) =>
    log("warn", ctx, msg, data),
  error: (ctx: string, msg: string, data?: unknown) =>
    log("error", ctx, msg, data),
};
