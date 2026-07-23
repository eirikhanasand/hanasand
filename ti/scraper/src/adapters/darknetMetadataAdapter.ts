import type { CollectionTask, SourceRecord } from "../types.ts";
import { hashContent, nowIso } from "../utils.ts";
import { emptyAdapterResult, type CollectionAdapter } from "./base.ts";
import { evaluateSourceForCollection, evaluateTaskForCollection } from "../policy/collectionPolicy.ts";
import { BLOCKED_OPERATIONS, DARKNET_METADATA_NETWORK_CONFIGS } from "./darknetMetadataConstants.ts";
import { buildLeakSiteMetadata, serializeLeakSite } from "./darknetMetadataCapture.ts";
import { evaluateDarknetMetadataPolicy, networkForSourceType, sanitizeLinks } from "./darknetMetadataPolicy.ts";
import type { ApprovedProxyBoundary, DarknetMetadataSourceType } from "./darknetMetadataTypes.ts";
import { sourceFieldReportTimestamp } from "../pipeline/sourceFieldReportTimestamp.ts";

export class DarknetMetadataAdapter implements CollectionAdapter {
  constructor(readonly type: DarknetMetadataSourceType, private readonly proxyBoundary?: ApprovedProxyBoundary) {}
  async collect(source: SourceRecord, task?: CollectionTask) {
    const policy = task ? evaluateTaskForCollection(source, task) : evaluateSourceForCollection(source);
    if (!policy.allowed) return emptyAdapterResult([policy.reason]);
    if (!policy.metadataOnly) return emptyAdapterResult(["darknet adapter refused non-metadata collection"]);
    if (source.type !== this.type) return emptyAdapterResult([`adapter ${this.type} cannot collect source type ${source.type}`]);
    const url = task?.targetUrl ?? source.url;
    const decision = evaluateDarknetMetadataPolicy(source, url, this.proxyBoundary);
    if (!decision.allowed) return emptyAdapterResult([decision.message]);
    if (!this.proxyBoundary) return emptyAdapterResult(["approved proxy boundary is not configured"]);
    const network = networkForSourceType(this.type);
    const cfg = this.proxyBoundary.config ?? DARKNET_METADATA_NETWORK_CONFIGS[network];
    const fetched = await this.proxyBoundary.fetchMetadata({ sourceId: source.id, network, url, taskId: task?.id, maxBytes: Math.min(task?.maxBytes ?? cfg.maxMetadataBytes, cfg.maxMetadataBytes), timeoutClass: cfg.timeoutClass, isolationId: this.proxyBoundary.id, actorName: source.metadata?.actorName ?? source.metadata?.actors?.[0], allowedOperations: ["metadata_only"], blockedOperations: BLOCKED_OPERATIONS });
    const leakSite = buildLeakSiteMetadata(url, { ...fetched, actorName: fetched.actorName ?? source.metadata?.actorName ?? source.metadata?.actors?.[0] });
    const configuredRole = String(source.metadata?.reporterRole ?? "publisher");
    const reporterRole = ["actor", "victim"].includes(configuredRole) && source.metadata?.reporterRoleVerified === true ? configuredRole : "publisher";
    const reportTimestamp = sourceFieldReportTimestamp({
      role: reporterRole,
      timestamp: fetched.sourceTimestamp,
      referenceUrl: fetched.publicReferenceUrl,
      sourceId: source.id,
      sourceName: source.name,
      evidencePath: "proxy.metadata.sourceTimestamp",
      parserVersion: "darknet-metadata-v2"
    });
    return {
      items: [{ tenantId: source.tenantId, sourceId: source.id, taskId: task?.id, url, collectedAt: nowIso(), publishedAt: fetched.sourceTimestamp, title: fetched.title, rawText: serializeLeakSite(leakSite, fetched.title), contentHash: hashContent(JSON.stringify({ leakSite, title: fetched.title })), language: source.language, links: sanitizeLinks(fetched.links ?? []), sensitive: true, metadata: { adapter: "darknet_metadata", network, sourceType: this.type, extractionProfile: "ransomware_victim_blog", proxyBoundaryId: this.proxyBoundary.id, captureMode: "metadata_only", urlHash: leakSite.urlHash, leakSite, policyDecision: decision, blockedOperations: BLOCKED_OPERATIONS, extractorVersion: "darknet-metadata-v2", reportTimestamps: reportTimestamp ? [reportTimestamp] : undefined } }],
      discovered: [],
      warnings: ["metadata only; no leaked contents or payload bodies captured"]
    };
  }
}
