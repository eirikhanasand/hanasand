import { extractReserved, sanitizeFields } from "./loggerSanitize.ts";
export { sanitizeFields } from "./loggerSanitize.ts";
export type { Logger, StructuredLogRecord } from "./loggerTypes.ts";
import type { Logger, StructuredLogRecord } from "./loggerTypes.ts";

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;

export function createLogger(minLevel: keyof typeof LEVELS = "info"): Logger {
  const min = LEVELS[minLevel];
  const write = (level: keyof typeof LEVELS, msg: string, fields: Record<string, unknown> = {}) => {
    if (LEVELS[level] < min) return;
    const record: StructuredLogRecord = {
      level,
      msg,
      at: new Date().toISOString(),
      service: "ti-scraper",
      ...extractReserved(fields),
      fields: sanitizeFields(fields)
    };
    if (Object.keys(record.fields ?? {}).length === 0) delete record.fields;
    console[level === "error" ? "error" : "log"](JSON.stringify(record));
  };

  return {
    debug: (msg, fields) => write("debug", msg, fields),
    info: (msg, fields) => write("info", msg, fields),
    warn: (msg, fields) => write("warn", msg, fields),
    error: (msg, fields) => write("error", msg, fields)
  };
}
