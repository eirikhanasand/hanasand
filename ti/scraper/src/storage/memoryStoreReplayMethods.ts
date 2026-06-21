// @ts-nocheck
import { nowIso, stableId } from "../utils.ts";
import { replayDiff } from "./memoryStoreHelpers.ts";

const put = (map: Map<string, any>, item: any) => (map.set(item.id, item), item);

export function installMemoryStoreReplayMethods(Store: any) {
  Store.prototype.createReplayJob = function (input: any) {
    const capture = this.mustCapture(input.captureId), requestedAt = input.requestedAt ?? nowIso();
    return put(this.replayJobs, { ...input, id: input.id ?? stableId("replay", `${input.captureId}:${input.toExtractorVersion}:${requestedAt}`), tenantId: input.tenantId ?? capture.tenantId, sourceId: input.sourceId || capture.sourceId, requestedAt, status: "queued", metadata: input.metadata ?? {} });
  };
  Store.prototype.saveReplayJob = function (job: any) {
    const capture = this.mustCapture(job.captureId), previous = this.replayJobs.get(job.id);
    if (previous && previous.captureId !== job.captureId) throw new Error(`Replay job capture cannot change: ${job.id}`);
    return put(this.replayJobs, { ...job, tenantId: job.tenantId ?? capture.tenantId, sourceId: job.sourceId || capture.sourceId });
  };
  Store.prototype.recordReplayResult = function (jobId: string, result: any) {
    const job = this.replayJobs.get(jobId); if (!job) throw new Error(`Unknown replay job: ${jobId}`);
    const capture = this.mustCapture(job.captureId);
    if (result.capture.id !== capture.id || result.capture.contentHash !== capture.contentHash) throw new Error(`Replay result must reference immutable capture: ${job.captureId}`);
    if (result.incident) this.saveIncident({ ...result.incident, captureId: capture.id });
    const completedAt = nowIso();
    return put(this.replayJobs, { ...job, status: "succeeded", startedAt: job.startedAt ?? completedAt, completedAt, incidentId: result.incident?.id, indicatorCount: result.indicators.length, entityCount: result.entities.length, diffSummary: replayDiff(job, result), metadata: { ...job.metadata, replayedContentHash: capture.contentHash, replayedStorageKind: capture.storageKind, rawEvidenceMutated: false } });
  };
}
