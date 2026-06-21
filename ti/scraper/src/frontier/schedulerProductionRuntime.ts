// @ts-nocheck
import type { CollectionTask } from "../types.ts";
import { age, by, iso, simulateSchedulerExecution } from "./schedulerProductionCore.ts";

export const schedulerBackpressureSummaryForTasks = (input: any) => ({ ...simulateSchedulerExecution(input), pressure: ((input.queued?.length ?? 0) + (input.leased?.length ?? 0)) > 500 ? "high" : "normal" });
export const schedulerWorkerLoopContract = (generatedAt = iso()) => ({ generatedAt, steps: ["lease", "collect", "ack"], invariants: ["do not duplicate leased tasks"] });
export const buildSchedulerQueueEconomics = (input: any) => ({ generatedAt: iso(input.now), queuedCount: input.queued?.length ?? 0, leasedCount: input.leased?.length ?? 0, deadLetterCount: input.deadLetters?.length ?? 0, workerSlots: input.workerSlots ?? 16, oldestQueueAgeSeconds: Math.max(0, ...(input.queued ?? []).map((t: CollectionTask) => age(t.queuedAt, input.now ?? new Date()))), bySourceType: by(input.queued ?? [], (t: CollectionTask) => t.sourceType) });
export const buildSchedulerRuntimeExecution = (input: any) => ({ generatedAt: iso(input.now), recommendedWorkers: Math.min(256, Math.max(1, Math.ceil((input.queueEconomics?.queuedCount ?? 0) / 25))), controls: [] });
export const buildSchedulerRuntimeSla = (input: any) => ({ generatedAt: iso(input.now), state: (input.queueEconomics?.oldestQueueAgeSeconds ?? 0) > 900 ? "breach" : "pass", metrics: [{ name: "queue_age", value: input.queueEconomics?.oldestQueueAgeSeconds ?? 0 }] });
export const buildSchedulerSlaEnforcement = (input: any) => ({ generatedAt: iso(input.now), releaseGate: input.runtimeSla?.state === "breach" ? "hold" : "pass", actions: input.runtimeSla?.state === "breach" ? ["requeue_transient_failures"] : [] });
export const buildSchedulerWorkerQueueCutover = (input: any) => ({ generatedAt: iso(input.now), backend: "postgres_queue", partitions: [{ name: "interactive", maxWorkers: 16 }, { name: "background", maxWorkers: 64 }] });
export const buildSchedulerWorkerSoakMigration = (input: any) => ({ generatedAt: iso(input.now), status: input.slaEnforcement?.releaseGate === "hold" ? "pause" : "run" });
export const buildSchedulerWorkerLeaseSoakHarness = (input: any) => ({ generatedAt: iso(input.now), scenarios: ["lease_expiry", "retry", "ack"] });
export const buildSchedulerProductionAdapterTelemetry = (input: any) => ({ generatedAt: iso(input.now), queueDepth: input.queueEconomics?.queuedCount ?? 0 });
export const buildSchedulerCanaryControlPlane = (input: any) => ({ generatedAt: iso(input.now), action: input.slaEnforcement?.releaseGate === "hold" ? "pause" : "expand" });
export const buildSchedulerDurableBackendReadiness = (input: any) => ({ generatedAt: iso(input.now), ready: (input.queueEconomics?.queuedCount ?? 0) < 100_000 });
export const buildSchedulerProductionLeaseSemantics = (input: any) => ({ generatedAt: iso(input.now), leaseSeconds: input.leaseSeconds ?? 300 });
export const buildSchedulerPersistenceReplayCutover = (input: any) => ({ generatedAt: iso(input.now), replayable: true });
export const buildSchedulerPostgresQueueAdapterReadiness = (input: any) => ({ generatedAt: iso(input.now), ready: true });
export const schedulerSoakBackpressurePacket = (simulation: any) => ({ simulation, packet: "backpressure" });
