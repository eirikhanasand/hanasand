export type WorkerKind = "collection" | "processing" | "telegram" | "browser" | "darknet_metadata";
export type WorkerState = "idle" | "running" | "stopped" | "failed";

export interface SupervisedWorker {
  id: string;
  kind: WorkerKind;
  state: WorkerState;
  startedAt?: string;
  stoppedAt?: string;
  failures: number;
  lastError?: string;
}
