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
    const actorName = fetched.actorName ?? source.metadata?.actorName ?? source.metadata?.actors?.[0];
    const victimNames = [...new Set((fetched.victimNames ?? []).map((name: string) => name.trim()).filter(Boolean))];
    const separateVictims = !!actorName && victimNames.length > 0;
    const multipleVictims = victimNames.length > 1;
    const configuredRole = String(source.metadata?.reporterRole ?? "publisher");
    const reporterRole = ["actor", "victim"].includes(configuredRole) && source.metadata?.reporterRoleVerified === true ? configuredRole : "publisher";
    // A listing's newest timestamp and description do not describe every victim in the list.
    const publishedAt = multipleVictims ? undefined : fetched.sourceTimestamp;
    const reportTimestamp = sourceFieldReportTimestamp({
      role: reporterRole,
      timestamp: publishedAt,
      referenceUrl: fetched.publicReferenceUrl,
      sourceId: source.id,
      sourceName: source.name,
      evidencePath: "proxy.metadata.sourceTimestamp",
      parserVersion: "darknet-metadata-v2"
    });
    const captureUrl = `https://restricted.invalid/capture/${hashContent(url)}`;
    const collectedAt = nowIso();
    const items = (separateVictims ? victimNames : [fetched.victimName]).map((victimName) => {
      const title = separateVictims ? `${actorName} ransomware claim: ${victimName}` : fetched.title;
      const leakSite = buildLeakSiteMetadata(url, multipleVictims
        ? { title, actorName, victimName, victimNames: [victimName], parserProfile: fetched.parserProfile }
        : { ...fetched, title, actorName, victimName });
      return { tenantId: source.tenantId, sourceId: source.id, taskId: task?.id, url: captureUrl, collectedAt, publishedAt, title, rawText: serializeLeakSite(leakSite, title), contentHash: hashContent(JSON.stringify({ leakSite, title })), language: source.language, links: sanitizeLinks(fetched.links ?? []), sensitive: true, metadata: { adapter: "darknet_metadata", network, sourceType: this.type, extractionProfile: "ransomware_victim_blog", proxyBoundaryId: this.proxyBoundary.id, captureMode: "metadata_only", urlHash: leakSite.urlHash, leakSite: { ...leakSite, ...(separateVictims ? { claimType: "ransomware_victim_publication" } : {}) }, jsonApi: separateVictims, useFirstSeenFallback: separateVictims, policyDecision: decision, blockedOperations: BLOCKED_OPERATIONS, extractorVersion: "darknet-metadata-v2", reportTimestamps: reportTimestamp ? [reportTimestamp] : undefined } };
    });
    return {
      items,
      discovered: [],
      warnings: ["metadata only; no leaked contents or payload bodies captured"]
    };
  }
}
