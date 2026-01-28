import { describe, it, expect } from "vitest";
import { MessageType, createMessage } from "../../types/messages";

describe("MessageType", () => {
  it("contains expected message types", () => {
    expect(MessageType.ENGAGEMENT_START).toBe("ENGAGEMENT_START");
    expect(MessageType.HARVEST_START).toBe("HARVEST_START");
    expect(MessageType.STATUS_REQUEST).toBe("STATUS_REQUEST");
    expect(MessageType.ACTION_BLOCKED).toBe("ACTION_BLOCKED");
  });
});

describe("createMessage", () => {
  it("creates a message with type, payload, and timestamp", () => {
    const before = Date.now();
    const msg = createMessage(MessageType.STATUS_REQUEST, { foo: "bar" });
    const after = Date.now();

    expect(msg.type).toBe("STATUS_REQUEST");
    expect(msg.payload).toEqual({ foo: "bar" });
    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });
});
