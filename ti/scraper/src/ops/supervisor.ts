import type { Logger } from "./logger.ts";
import type { MetricsRegistry } from "./metrics.ts";
export type { SupervisedWorker, WorkerKind, WorkerState } from "./supervisorTypes.ts";
import type { SupervisedWorker, WorkerKind, WorkerState } from "./supervisorTypes.ts";
export class WorkerSupervisor {
  private readonly workers = new Map<string, SupervisedWorker>();
  constructor(
    private readonly logger: Logger,
    private readonly metrics: MetricsRegistry
  ) {}
  register(id: string, kind: WorkerKind): SupervisedWorker {
    const worker: SupervisedWorker = { id, kind, state: "idle", failures: 0 };
    this.workers.set(id, worker);
    this.metrics.gauge("scraper_workers_registered", this.workers.size);
    this.logger.info("worker registered", { event: "worker.registered", workerId: id, kind });
    return worker;
  }
  markRunning(id: string): SupervisedWorker {
    const worker = this.requireWorker(id);
    worker.state = "running";
    worker.startedAt = new Date().toISOString();
    worker.stoppedAt = undefined;
    this.updateStateMetrics();
    return worker;
  }
  markStopped(id: string): SupervisedWorker {
    const worker = this.requireWorker(id);
    worker.state = "stopped";
    worker.stoppedAt = new Date().toISOString();
    this.updateStateMetrics();
    this.logger.info("worker stopped", { event: "worker.stopped", workerId: id, kind: worker.kind });
    return worker;
  }
  markFailed(id: string, error: unknown): SupervisedWorker {
    const worker = this.requireWorker(id);
    worker.state = "failed";
    worker.stoppedAt = new Date().toISOString();
    worker.failures += 1;
    worker.lastError = error instanceof Error ? error.message : String(error);
    this.metrics.increment("scraper_worker_failures_total", 1, { kind: worker.kind });
    this.updateStateMetrics();
    this.logger.error("worker failed", { event: "worker.failed", workerId: id, kind: worker.kind, error: worker.lastError });
    return worker;
  }
  snapshot(): SupervisedWorker[] {
    return [...this.workers.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  private requireWorker(id: string): SupervisedWorker {
    const worker = this.workers.get(id);
    if (!worker) throw new Error(`Unknown worker: ${id}`);
    return worker;
  }
  private updateStateMetrics(): void {
    const states: WorkerState[] = ["idle", "running", "stopped", "failed"];
    for (const state of states) {
      this.metrics.gauge("scraper_workers_by_state", this.snapshot().filter((worker) => worker.state === state).length, { state });
    }
  }
}
