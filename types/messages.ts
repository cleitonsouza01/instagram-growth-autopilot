export const MessageType = {
  // Engagement
  ENGAGEMENT_START: "ENGAGEMENT_START",
  ENGAGEMENT_STOP: "ENGAGEMENT_STOP",
  ENGAGEMENT_STATUS: "ENGAGEMENT_STATUS",
  // Harvesting
  HARVEST_START: "HARVEST_START",
  HARVEST_COMPLETE: "HARVEST_COMPLETE",
  HARVEST_RESULT: "HARVEST_RESULT",
  // Prospects
  PROSPECT_QUEUED: "PROSPECT_QUEUED",
  PROSPECT_ENGAGED: "PROSPECT_ENGAGED",
  ENGAGE_PROSPECT: "ENGAGE_PROSPECT",
  ENGAGE_RESULT: "ENGAGE_RESULT",
  // Safety
  RATE_LIMIT_HIT: "RATE_LIMIT_HIT",
  ACTION_BLOCKED: "ACTION_BLOCKED",
  COOLDOWN_START: "COOLDOWN_START",
  COOLDOWN_END: "COOLDOWN_END",
  // Status
  STATUS_REQUEST: "STATUS_REQUEST",
  STATUS_RESPONSE: "STATUS_RESPONSE",
  STATUS_UPDATE: "STATUS_UPDATE",
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
