import { asRecord, readString } from "./productionSoakUtils.ts";

export function runIdFrom(value: Record<string, unknown> | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value.runId === "string") return value.runId;
  if (typeof value.run_id === "string") return value.run_id;
  return runIdFrom(asRecord(value.run)) ?? runIdFrom(asRecord(value.scheduler)) ?? runIdFrom(asRecord(value.planner));
}

export function hasRunId(value: Record<string, unknown> | undefined): boolean {
  return Boolean(runIdFrom(value));
}

export function cursorFrom(value: Record<string, unknown> | undefined): string | undefined {
  if (!value) return undefined;
  for (const key of ["cursor", "nextCursor", "pollCursor", "deltaCursor"]) {
    const cursor = readString(value, key);
    if (cursor) return cursor;
  }
  return cursorFrom(asRecord(value.run)) ?? cursorFrom(asRecord(value.scheduler)) ?? cursorFrom(asRecord(value.delta));
}

export function hasPartial(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  if (value.status === "partial" || value.state === "partial") return true;
  return hasPartial(asRecord(value.run)) || hasPartial(asRecord(value.scheduler)) || hasPartial(asRecord(value.publicChannel));
}
