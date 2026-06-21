// @ts-nocheck
import type { CollectionTask } from "../types.ts";
import { iso } from "./schedulerProductionCore.ts";

export class InMemorySchedulerQueueRepository {
  private tasks: CollectionTask[] = [];
  enqueue(task: CollectionTask) { this.tasks.push(task); return task.id; }
  lease(workerId = "worker", now = new Date()) { const task = this.tasks.shift(); return task ? { ...task, lease: { workerId, leasedAt: iso(now) } } : undefined; }
  ack(taskId: string, status = "completed") { return { taskId, status }; }
  snapshot() { return [...this.tasks]; }
}

export class PostgresSchedulerQueueRepository extends InMemorySchedulerQueueRepository {
  constructor(readonly input: any = {}) { super(); }
}

export const createSchedulerQueueRepository = (input: any = {}) => input.kind === "postgres" ? new PostgresSchedulerQueueRepository(input) : new InMemorySchedulerQueueRepository();
