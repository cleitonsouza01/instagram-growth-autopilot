type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_PREFIX = "[IG-Autopilot]";

function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: unknown,
): void {
  const timestamp = new Date().toISOString();
  const formatted = `${LOG_PREFIX} [${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;

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
