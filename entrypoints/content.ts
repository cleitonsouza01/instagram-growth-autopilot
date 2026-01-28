import { logger } from "../utils/logger";

export default defineContentScript({
  matches: ["https://www.instagram.com/*"],
  runAt: "document_idle",

  main() {
    logger.info("content", "Content script injected on instagram.com");

    // Listen for messages from the service worker
    chrome.runtime.onMessage.addListener(handleMessage);
  },
});

function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean {
  const msg = message as { type?: string; payload?: unknown };

  if (!msg.type) {
    return false;
  }

  logger.debug("content", `Message received: ${msg.type}`);

  switch (msg.type) {
    case "HARVEST_START":
      // Will be implemented in Phase 3
      sendResponse({ status: "not_implemented" });
      return false;

    case "ENGAGE_PROSPECT":
      // Will be implemented in Phase 3
      sendResponse({ status: "not_implemented" });
      return false;

    default:
      return false;
  }
}
