export const MessageType = {
  // Engagement
  ENGAGEMENT_START: "ENGAGEMENT_START",
  ENGAGEMENT_STOP: "ENGAGEMENT_STOP",
  ENGAGEMENT_STATUS: "ENGAGEMENT_STATUS",
  // Harvesting (legacy - orchestrated in content script)
  HARVEST_START: "HARVEST_START",
  HARVEST_COMPLETE: "HARVEST_COMPLETE",
  HARVEST_RESULT: "HARVEST_RESULT",
  // Prospects
  PROSPECT_QUEUED: "PROSPECT_QUEUED",
  PROSPECT_ENGAGED: "PROSPECT_ENGAGED",
  ENGAGE_PROSPECT: "ENGAGE_PROSPECT",
  ENGAGE_RESULT: "ENGAGE_RESULT",
  // Atomic API operations (content script handles single requests)
  SET_CSRF_TOKEN: "SET_CSRF_TOKEN",
  API_FETCH_USER: "API_FETCH_USER",
  API_FETCH_FOLLOWERS: "API_FETCH_FOLLOWERS",
  API_LIKE_POST: "API_LIKE_POST",
  API_GET_USER_MEDIA: "API_GET_USER_MEDIA",
  API_FOLLOW_USER: "API_FOLLOW_USER",
  // Content script ready signal
  CONTENT_SCRIPT_READY: "CONTENT_SCRIPT_READY",
  // Safety
  RATE_LIMIT_HIT: "RATE_LIMIT_HIT",
  ACTION_BLOCKED: "ACTION_BLOCKED",
  COOLDOWN_START: "COOLDOWN_START",
  COOLDOWN_END: "COOLDOWN_END",
  // Status
  STATUS_REQUEST: "STATUS_REQUEST",
  STATUS_RESPONSE: "STATUS_RESPONSE",
  STATUS_UPDATE: "STATUS_UPDATE",
  // Analytics
  ANALYTICS_TODAY: "ANALYTICS_TODAY",
  // Scheduling
  SCHEDULE_POST: "SCHEDULE_POST",
  CANCEL_SCHEDULED: "CANCEL_SCHEDULED",
  PUBLISH_SCHEDULED: "PUBLISH_SCHEDULED",
  // Ghost mode
  GHOST_MODE_TOGGLE: "GHOST_MODE_TOGGLE",
  GHOST_MODE_STATUS: "GHOST_MODE_STATUS",
  // Activity log
  ACTIVITY_LOG: "ACTIVITY_LOG",
  // Debug logs
  GET_LOGS: "GET_LOGS",
  CLEAR_LOGS: "CLEAR_LOGS",
  // Action logging (from content to background for IndexedDB persistence)
  LOG_ACTION: "LOG_ACTION",
  // Competitor management
  ADD_COMPETITOR: "ADD_COMPETITOR",
  REMOVE_COMPETITOR: "REMOVE_COMPETITOR",
  GET_COMPETITORS: "GET_COMPETITORS",
  // Target profile management
  ADD_TARGET_PROFILE: "ADD_TARGET_PROFILE",
  REMOVE_TARGET_PROFILE: "REMOVE_TARGET_PROFILE",
  GET_TARGET_PROFILES: "GET_TARGET_PROFILES",
  // Settings management
  GET_SETTINGS: "GET_SETTINGS",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: number;
}

export function createMessage<T>(
  type: MessageType,
  payload: T,
): ExtensionMessage<T> {
  return { type, payload, timestamp: Date.now() };
}
