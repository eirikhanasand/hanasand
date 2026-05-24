import type { AdapterRunResult, CollectionTask, SourceRecord } from "../types.ts";

export interface CollectionAdapter {
  readonly type: SourceRecord["type"];
  collect(source: SourceRecord, task?: CollectionTask): Promise<AdapterRunResult>;
}

export function emptyAdapterResult(warnings: string[] = []): AdapterRunResult {
  return { items: [], discovered: [], warnings };
}
