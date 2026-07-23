import type { RawCapture } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import { authorizeOrganizationRequest } from "./organizationRoutes.ts";
import { error, json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

type PurgeMode = "scheduled" | "deletion";
type PrivacyItem = {
  sourceService: "ti-scraper";
  recordType: string;
  recordId: string;
  action: "delete" | "redact" | "retain";
  status: "deleted" | "redacted" | "protected" | "failed";
  reason: string;
  error?: string;
};

const ORGANIZATION_PRIVACY_INVENTORY = [
  ["members", "organization_member", "listOrganizationMembers", "organization", false],
  ["invites", "organization_invite", "listOrganizationInvites", "organization", false],
  ["destinations", "webhook_destination", "listWebhookDestinations", "organization", false],
  ["watchlists", "dwm_watchlist", "listDwmWatchlists", "tenant", false],
  ["captures", "capture", "listCaptures", "tenant", true],
  ["deliveries", "dwm_webhook_delivery", "listDwmWebhookDeliveries", "tenant", true],
  ["sources", "source", "listSources", "tenant", false],
  ["incidents", "incident", "listIncidents", "tenant", true],
  ["entities", "entity", "listExtractedEntities", "tenant", true],
  ["indicators", "indicator", "listIndicators", "tenant", true],
  ["actorProfiles", "actor_profile", "listActorProfilesForOwnership", "tenant", true],
  ["actorAliases", "actor_alias", "listActorAliasesForOwnership", "tenant", true],
  ["actorProfileIdentityHistory", "actor_profile_identity_history", "listActorProfileIdentityHistoryForOwnership", "actor_history", true],
  ["actorIdentityCatalogs", "actor_identity_catalog", "listActorIdentityCatalogs", "tenant", true],
  ["actorIdentities", "actor_identity", "listActorIdentities", "tenant", true],
  ["evidenceLinks", "evidence_link", "listEvidenceLinks", "tenant", true],
  ["validationRecords", "validation_record", "listValidationRecords", "tenant", true],
  ["evaluationLabels", "evaluation_label", "listEvaluationLabels", "tenant", true],
  ["collectionRuns", "collection_run", "listRuns", "tenant", true],
  ["sourceHealth", "source_health", "listSourceHealthObservations", "tenant", true],
  ["timelinessRecords", "timeliness_record", "listTimelinessRecords", "tenant", true],
  ["claims", "intelligence_claim", "listIntelligenceClaims", "tenant", true],
  ["claimEvidence", "claim_evidence", "listClaimEvidence", "tenant", true],
  ["claimReviews", "claim_review", "listClaimReviews", "tenant", true],
  ["collectionPlans", "collection_plan", "listPlans", "tenant", false],
  ["replayJobs", "replay_job", "listReplayJobs", "tenant", true],
  ["discoveryEvidence", "discovery_evidence", "listDiscoveryEvidence", "tenant", true],
  ["liveSearchSnapshots", "live_search_snapshot", "listLiveSearchSnapshots", "tenant", true],
  ["evidenceDeltas", "evidence_delta", "listEvidenceDeltas", "tenant", true],
  ["analystMetadataReviewTasks", "analyst_metadata_review_task", "listAnalystMetadataReviewTasks", "tenant", true],
  ["analystSourceActivationPackets", "analyst_source_activation_packet", "listAnalystSourceActivationPackets", "tenant", true],
  ["analystVictimNotificationPackets", "analyst_victim_notification_packet", "listAnalystVictimNotificationPackets", "tenant", true],
  ["analystClaimLedgerEntries", "analyst_claim_ledger_entry", "listAnalystClaimLedgerEntries", "tenant", true],
  ["analystLoopSnapshots", "analyst_loop_snapshot", "listAnalystLoopSnapshots", "tenant", true],
  ["evaluationBenchmarks", "evaluation_benchmark", "listEvaluationBenchmarks", "tenant", true],
  ["evaluationAnnotations", "evaluation_annotation", "listEvaluationAnnotations", "tenant", true],
  ["evaluationAdjudications", "evaluation_adjudication", "listEvaluationAdjudications", "tenant", true],
  ["cases", "case", "listCases", "tenant", true],
  ["alerts", "alert", "listDwmAlerts", "tenant", true],
  ["actorOrganizationReviews", "actor_org_relevance_review", "listActorOrgRelevanceReviews", "tenant", true]
] as const;

export async function handleOrganizationPrivacyRequest(request: Request, options: ApiServerOptions, organizationId: string): Promise<Response> {
  const access = await authorizeOrganizationRequest(request, options, organizationId, request.method !== "GET", ["owner", "admin"], true);
  if (access.error) return access.error;
  if (!access.identity) return error("authentication_unavailable", "Organization privacy authentication is not configured", 503);
  if (!(options.store as any).getOrganization?.(organizationId)) return error("organization_not_found", "Organization is not mirrored into the TI runtime", 404);
  if (request.method === "GET") return json(await exportOrganizationPrivacyData(options, organizationId));
  if (request.method !== "POST") return error("method_not_allowed", "Organization privacy supports GET and POST", 405);

  const body = await readJson<any>(request);
  if (body.action !== "purge") return error("invalid_privacy_action", "Organization privacy action must be purge", 400);
  const cutoffAt = validIso(body.cutoffAt);
  if (!cutoffAt) return error("invalid_retention_cutoff", "A valid retention cutoff is required", 400);
  const mode: PurgeMode = body.mode === "deletion" ? "deletion" : "scheduled";
  const result = await purgeOrganizationPrivacyData(options, {
    organizationId,
    cutoffAt,
    mode,
    limit: boundedLimit(body.limit),
    protectedOffset: boundedOffset(body.protectedOffset),
    runId: String(body.runId ?? "").trim() || stableId("org_retention", `${organizationId}:${cutoffAt}:${mode}`),
    protectedInviteIds: array(body.protectedInviteIds).map(String)
  });
  return json(result, result.failed.length ? 503 : 200);
}

export async function exportOrganizationPrivacyData(options: ApiServerOptions, organizationId: string) {
  const store = options.store as any;
  const organization = store.getOrganization?.(organizationId);
  if (!organization) throw new Error("Organization is not mirrored into the TI runtime");
  const inventory = await organizationPrivacyInventory(store, organizationId);
  const captures = inventory.captures;
  const claims = inventory.claims;
  const alerts = inventory.alerts;
  const cases = inventory.cases;
  const heldClaims = claims.filter(heldClaim);
  const heldClaimIds = heldClaims.map((row: any) => String(row.id));
  const heldCaptureIds = unique([...captures.filter(heldCapture).map((row: any) => String(row.id)), ...heldClaims.flatMap(claimCaptureIds)]);
  const heldAlertIds = alerts.filter((row: any) => alertCaptureIds(row).some(id => heldCaptureIds.includes(id))).map((row: any) => String(row.id));
  const exportedAt = nowIso();
  const data = {
    organization: safeRecord(organization),
    ...Object.fromEntries(ORGANIZATION_PRIVACY_INVENTORY.map(([key]) => [key, inventory[key].map(key === "destinations" ? safeDestination : key === "captures" ? captureExport : safeRecord)]))
  };
  return {
    schemaVersion: "organization.privacy_export.ti.v1",
    organizationId,
    tenantId: organizationId,
    exportedAt,
    data,
    counts: Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
    protection: {
      heldCaptureIds,
      heldClaimIds,
      heldAlertIds,
      immutableRecordCounts: { alerts: alerts.length, cases: cases.length, claims: claims.length, actorOrganizationReviews: inventory.actorOrganizationReviews.length },
      inventory: Object.fromEntries(ORGANIZATION_PRIVACY_INVENTORY.map(([key]) => [key, inventory[key].length])),
      explanation: "Legal-held records remain intact. Non-held organization records are deleted or privacy-redacted to stable audit/linkage fields; customer payloads, identifiers, notes, owners, terms, and event content are not retained after deletion."
    },
    checksum: stableId("org_privacy_export", JSON.stringify({ organizationId, exportedAt, data }))
  };
}

export async function purgeOrganizationPrivacyData(options: ApiServerOptions, input: { organizationId: string; cutoffAt: string; mode: PurgeMode; limit: number; protectedOffset?: number; runId: string; protectedInviteIds?: string[] }) {
  const store = options.store as any;
  let organization = store.getOrganization?.(input.organizationId);
  if (!organization) throw new Error("Organization is not mirrored into the TI runtime");
  if (input.mode === "deletion" && !organization.privacyDeletedAt) {
    if (organization.privacyDeletionRunId && organization.privacyDeletionRunId !== input.runId) throw new Error("Organization is locked by another privacy deletion run");
    organization = store.saveOrganization({
      ...organization,
      status: "suspended",
      privacyDeletionRunId: input.runId,
      privacyDeletionPendingAt: organization.privacyDeletionPendingAt ?? nowIso(),
      updatedAt: nowIso()
    });
    await store.flush?.();
  }
  const selected = (await retentionCandidates(store, input)).slice(0, input.limit);
  const reconciled = await reconciledItems(store, input.organizationId, input.runId);
  const completed: PrivacyItem[] = [];
  const failed: PrivacyItem[] = [];

  for (const candidate of selected) {
    try {
      if (candidate.recordType === "capture" && input.mode !== "deletion") {
        const capture = candidate.record as RawCapture;
        if (capture.objectRef) {
          const deleteObject = (options.objectStore as any)?.deleteObject;
          if (typeof deleteObject !== "function") throw new Error("Object store is unavailable for retained object deletion");
          if (await deleteObject.call(options.objectStore, capture.objectRef, `organization-retention:${input.runId}`) !== true) {
            throw new Error("Object store did not confirm retained object deletion");
          }
        }
        store.replaceCaptureForRetention({
          ...capture,
          body: undefined,
          objectRef: undefined,
          storageKind: "metadata_only",
          redaction: { applied: true, policy: "organization_retention", reason: `Organization retention cutoff ${input.cutoffAt}` },
          metadata: { ...capture.metadata, retentionAudit: [...array(capture.metadata?.retentionAudit), { runId: input.runId, action: "redact", reason: candidate.reason, appliedAt: nowIso() }] }
        });
      } else if (candidate.recordType === "dwm_webhook_delivery" && input.mode !== "deletion") {
        store.saveDwmWebhookDelivery({ ...candidate.record, payload: undefined, responseBody: undefined, responseSummary: undefined, error: undefined, retentionRedactedAt: nowIso(), retentionRunId: input.runId, retentionReason: candidate.reason });
      } else if (candidate.recordType === "actor_profile_identity_history") {
        if (!await store.replaceActorProfileIdentityHistoryForRetention(actorHistoryTombstone(candidate.record, candidate, input.runId))) throw new Error(`Stored ${candidate.recordType} disappeared before privacy redaction`);
      } else if (candidate.action === "redact") {
        if (candidate.recordType === "capture" && candidate.record.objectRef) {
          const deleteObject = (options.objectStore as any)?.deleteObject;
          if (typeof deleteObject !== "function") throw new Error("Object store is unavailable for retained object deletion");
          if (await deleteObject.call(options.objectStore, candidate.record.objectRef, `organization-retention:${input.runId}`) !== true) throw new Error("Object store did not confirm retained object deletion");
        }
        if (!store.replaceRecordForRetention(candidate.recordType, privacyTombstone(candidate.record, candidate, input.runId))) throw new Error(`Stored ${candidate.recordType} disappeared before privacy redaction`);
      } else {
        const completedItem = item(candidate.recordType, candidate.record.id, candidate.action, "deleted", candidate.reason);
        if (!store.deleteWorkflowForRetention(candidate.recordType, candidate.record.id, { organizationId: input.organizationId, runId: input.runId, item: completedItem })) {
          continue;
        }
      }
      completed.push(item(candidate.recordType, candidate.record.id, candidate.action, candidate.action === "delete" ? "deleted" : "redacted", candidate.reason));
    } catch (caught) {
      failed.push(item(candidate.recordType, candidate.record.id, candidate.action, "failed", candidate.reason, caught));
    }
  }

  const remaining = await retentionCandidates(store, input);
  const protection = await protectionState(store, input.organizationId, input.cutoffAt, input.mode);
  const protectedOffset = input.protectedOffset ?? 0;
  const protectedPage = protection.items.slice(protectedOffset, protectedOffset + Math.max(0, input.limit - selected.length));
  const protectedHasMore = protectedOffset + protectedPage.length < protection.items.length;
  if (input.mode === "deletion" && !organization.privacyDeletedAt && !remaining.length && !failed.length && !protectedHasMore) {
    for (const member of byOrganization(store.listOrganizationMembers?.(), input.organizationId)) {
      const completedItem = item("organization_member", member.id, "delete", "deleted", "organization_privacy_deletion");
      if (store.deleteWorkflowForRetention("organization_member", member.id, { organizationId: input.organizationId, runId: input.runId, item: completedItem })) {
        completed.push(completedItem);
      }
    }
    store.saveOrganization({
      id: organization.id ?? input.organizationId,
      tenantId: input.organizationId,
      name: "Deleted organization",
      status: "suspended",
      updatedAt: nowIso(),
      privacyDeletionRunId: input.runId,
      privacyDeletedAt: nowIso(),
      privacyRetentionAudit: store.getOrganization?.(input.organizationId)?.privacyRetentionAudit ?? organization.privacyRetentionAudit ?? []
    });
  }
  await store.flush?.();
  return {
    schemaVersion: "organization.privacy_purge.ti.v1",
    organizationId: input.organizationId,
    tenantId: input.organizationId,
    runId: input.runId,
    mode: input.mode,
    cutoffAt: input.cutoffAt,
    selected: selected.length,
    processed: selected.length + protectedPage.length,
    completed: [...reconciled, ...completed],
    failed,
    protected: protectedPage,
    protection: protection.summary,
    heldAlertIds: protection.heldAlertIds,
    protectedWatchlistIds: protection.protectedWatchlistIds,
    hasMore: remaining.length > 0 || protectedHasMore,
    remainingEligible: remaining.length,
    protectedOffset,
    protectedRemaining: Math.max(0, protection.items.length - protectedOffset - protectedPage.length),
    generatedAt: nowIso()
  };
}

async function retentionCandidates(store: any, input: { organizationId: string; cutoffAt: string; mode: PurgeMode; protectedInviteIds?: string[] }) {
  const protection = await protectionState(store, input.organizationId, input.cutoffAt, input.mode);
  const heldAlertIds = new Set(protection.heldAlertIds);
  const protectedCaptureIds = new Set(protection.protectedCaptureIds);
  const protectedWatchlistIds = new Set(protection.protectedWatchlistIds);
  const protectedInviteIds = new Set(input.protectedInviteIds ?? []);
  const candidates: Array<{ recordType: string; record: any; action: "delete" | "redact"; reason: string; at: string }> = [];
  for (const record of scoped(store.listCaptures?.(), input.organizationId)) {
    if (protectedCaptureIds.has(String(record.id)) || (input.mode === "deletion" ? record.privacyRedactedAt : !oldEnough(record, input.cutoffAt, "collectedAt") || (!record.body && !record.objectRef))) continue;
    candidates.push({ recordType: "capture", record, action: "redact", reason: input.mode === "deletion" ? "organization_privacy_deletion" : "organization_retention_expired", at: record.collectedAt });
  }
  for (const record of scoped(store.listDwmWebhookDeliveries?.(), input.organizationId)) {
    if (heldAlertIds.has(String(record.alertId ?? "")) || (input.mode === "deletion" ? record.privacyRedactedAt : !oldEnough(record, input.cutoffAt, "attemptedAt", "createdAt", "updatedAt") || !hasRetainedDeliveryContent(record))) continue;
    candidates.push({ recordType: "dwm_webhook_delivery", record, action: "redact", reason: input.mode === "deletion" ? "organization_privacy_deletion" : "delivery_payload_retention_expired", at: record.attemptedAt ?? record.createdAt ?? record.updatedAt });
  }
  if (input.mode !== "deletion") addWorkflowCandidates(candidates, byOrganization(store.listOrganizationMembers?.(), input.organizationId), "organization_member", input, (record) => String(record.status ?? "").toLowerCase() === "removed");
  addWorkflowCandidates(candidates, byOrganization(store.listOrganizationInvites?.(), input.organizationId), "organization_invite", input, (record) => !protectedInviteIds.has(String(record.id)) && (input.mode === "deletion" || !["pending", "invited"].includes(String(record.status ?? "").toLowerCase())));
  addWorkflowCandidates(candidates, byOrganization(store.listWebhookDestinations?.(), input.organizationId), "webhook_destination", input, (record) => input.mode === "deletion" || !["active", "enabled"].includes(String(record.status ?? "").toLowerCase()));
  addWorkflowCandidates(candidates, scoped(store.listDwmWatchlists?.(), input.organizationId), "dwm_watchlist", input, (record) => {
    if (protectedWatchlistIds.has(String(record.id))) return false;
    return input.mode === "deletion" || !["active", "enabled"].includes(String(record.status ?? "").toLowerCase());
  });
  const inventory = await organizationPrivacyInventory(store, input.organizationId);
  for (const [key, recordType, , , scheduled] of ORGANIZATION_PRIVACY_INVENTORY) {
    if (["members", "invites", "destinations", "watchlists", "captures", "deliveries"].includes(key)) continue;
    for (const record of inventory[key]) {
      if (privacyRedacted(record, recordType) || protection.protectedRecordIds.includes(String(record.id))) continue;
      if (input.mode !== "deletion" && (!scheduled || !oldEnough(record, input.cutoffAt, ...RETENTION_TIMESTAMPS))) continue;
      candidates.push({ recordType, record, action: "redact", reason: input.mode === "deletion" ? "organization_privacy_deletion" : "organization_retention_expired", at: retentionTimestamp(record) ?? input.cutoffAt });
    }
  }
  return candidates.sort((left, right) => Date.parse(left.at) - Date.parse(right.at) || `${left.recordType}:${left.record.id}`.localeCompare(`${right.recordType}:${right.record.id}`));
}

function addWorkflowCandidates(output: Array<{ recordType: string; record: any; action: "delete" | "redact"; reason: string; at: string }>, records: any[], recordType: string, input: { cutoffAt: string; mode: PurgeMode }, eligible: (record: any) => boolean) {
  for (const record of records) {
    if (!eligible(record) || (input.mode !== "deletion" && !oldEnough(record, input.cutoffAt, ...LIFECYCLE_TIMESTAMPS))) continue;
    output.push({ recordType, record, action: "delete", reason: input.mode === "deletion" ? "organization_privacy_deletion" : "organization_retention_expired", at: LIFECYCLE_TIMESTAMPS.map(field => record[field]).find(Boolean) ?? input.cutoffAt });
  }
}

async function protectionState(store: any, organizationId: string, cutoffAt: string, mode: PurgeMode) {
  const inventory = await organizationPrivacyInventory(store, organizationId);
  const captures = inventory.captures;
  const claims = inventory.claims;
  const alerts = inventory.alerts;
  const cases = inventory.cases;
  const reviews = inventory.actorOrganizationReviews;
  const heldCaptureIds = new Set(captures.filter(heldCapture).map((row: any) => String(row.id)));
  const heldClaims = claims.filter(heldClaim);
  const heldClaimIds = heldClaims.map((row: any) => String(row.id));
  const protectedCaptureIds = unique([...heldCaptureIds, ...heldClaims.flatMap(claimCaptureIds)]);
  const protectedRecordIds = new Set([...protectedCaptureIds, ...heldClaimIds]);
  const records = ORGANIZATION_PRIVACY_INVENTORY.flatMap(([key, recordType]) => inventory[key].map(record => ({ recordType, record })));
  const recordsById = new Map<string, Array<{ recordType: string; record: any }>>();
  for (const entry of records) {
    const id = String(entry.record.id);
    recordsById.set(id, [...(recordsById.get(id) ?? []), entry]);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const { record } of records) {
      const id = String(record.id);
      if (protectedRecordIds.has(id)) {
        for (const reference of recordReferenceIds(record)) {
          if (!recordsById.has(reference) || protectedRecordIds.has(reference)) continue;
          protectedRecordIds.add(reference);
          changed = true;
        }
      } else if (heldCapture(record) || heldClaim(record) || recordReferenceIds(record).some(reference => protectedRecordIds.has(reference))) {
        protectedRecordIds.add(id);
        changed = true;
      }
    }
  }
  const heldAlertIds = alerts.filter((alert: any) => protectedRecordIds.has(String(alert.id))).map((row: any) => String(row.id));
  const protectedWatchlistIds = unique(alerts.filter((row: any) => heldAlertIds.includes(String(row.id))).flatMap((row: any) => [...array(row.watchlistIds), ...array(row.watchlistItemIds), row.matchedTerm?.id]).filter(Boolean).map(String));
  const items: PrivacyItem[] = records
    .filter(({ record }) => protectedRecordIds.has(String(record.id)) && (mode === "deletion" || oldEnough(record, cutoffAt, ...RETENTION_TIMESTAMPS)))
    .map(({ recordType, record }) => item(recordType, record.id, "retain", "protected", heldCapture(record) || heldClaim(record) ? "legal_hold" : "legal_hold_linked_evidence"));
  return {
    items,
    protectedCaptureIds,
    protectedRecordIds: [...protectedRecordIds],
    heldAlertIds,
    protectedWatchlistIds,
    summary: {
      legalHeldCaptures: protectedCaptureIds.length,
      legalHeldClaims: heldClaimIds.length,
      legalHeldAlerts: heldAlertIds.length,
      immutableAlerts: alerts.length,
      immutableCases: cases.length,
      immutableClaims: claims.length,
      immutableActorOrganizationReviews: reviews.length,
      protectedItemsAtCutoff: items.length
    }
  };
}

function alertCaptureIds(alert: any) {
  return unique([
    ...array(alert.captureIds),
    ...array(alert.provenance?.captureIds),
    ...array(alert.evidence).flatMap((entry: any) => [entry?.id, entry?.captureId, entry?.provenance?.captureId])
  ].filter(Boolean).map(String));
}

function claimCaptureIds(claim: any) { return unique([...array(claim.captureIds), ...array(claim.evidenceCaptureIds), claim.captureId].filter(Boolean).map(String)); }
async function reconciledItems(store: any, organizationId: string, runId: string): Promise<PrivacyItem[]> {
  const inventory = await organizationPrivacyInventory(store, organizationId);
  const items = [
    ...scoped(store.listCaptures?.(), organizationId)
      .filter((capture: any) => array(capture.metadata?.retentionAudit).some((entry: any) => entry?.runId === runId))
      .map((capture: any) => item("capture", capture.id, "redact", "redacted", array(capture.metadata?.retentionAudit).find((entry: any) => entry?.runId === runId)?.reason ?? "organization_retention_expired")),
    ...scoped(store.listDwmWebhookDeliveries?.(), organizationId)
      .filter((delivery: any) => delivery.retentionRunId === runId)
      .map((delivery: any) => item("dwm_webhook_delivery", delivery.id, "redact", "redacted", delivery.retentionReason ?? "delivery_payload_retention_expired")),
    ...ORGANIZATION_PRIVACY_INVENTORY.flatMap(([key, recordType]) => inventory[key]
      .filter(record => (recordType === "actor_profile_identity_history" ? record.originalRecord : record).privacyDeletionRunId === runId)
      .map(record => item(recordType, record.id, "redact", "redacted", (recordType === "actor_profile_identity_history" ? record.originalRecord : record).privacyReason ?? "organization_privacy_deletion"))),
    ...array(store.getOrganization?.(organizationId)?.privacyRetentionAudit)
      .filter((entry: any) => entry.runId === runId)
      .map((entry: any) => item(entry.recordType, entry.recordId, entry.action ?? "delete", entry.status ?? "deleted", entry.reason ?? "organization_privacy_deletion"))
  ];
  return [...new Map(items.map(entry => [`${entry.recordType}:${entry.recordId}`, entry])).values()];
}

const RETENTION_TIMESTAMPS = ["updatedAt", "completedAt", "reviewedAt", "labeledAt", "matchedAt", "checkedAt", "collectedAt", "observedAt", "capturedAt", "savedAt", "createdAt", "firstSeenAt", "lastSeenAt"];
const LIFECYCLE_TIMESTAMPS = ["removedAt", "revokedAt", "acceptedAt", "expiredAt", "archivedAt", "completedAt", "updatedAt", "createdAt", "observedAt", "capturedAt"];
const PRIVACY_AUDIT_FIELDS = new Set(["id", "tenantId", "organizationId", "orgId", "sourceId", "captureId", "captureIds", "incidentId", "entityId", "indicatorId", "claimId", "alertId", "caseId", "subjectType", "subjectId", "relationship", "type", "kind", "status", "action", "previousState", "nextState", "reviewState", "deliveryState", "outcome", "confidence", "claimType", "evidenceStage", "extractionMethod", "extractorVersion", "corroborationState", "sourceCount", "evidenceCount", "legalHold", "retentionClass", "contentHash", "normalizedTextHash", "mediaType", "storageKind", "unsafeMaterialAccessed", "dryRun", ...RETENTION_TIMESTAMPS]);
async function organizationPrivacyInventory(store: any, organizationId: string): Promise<Record<string, any[]>> {
  return Object.fromEntries(await Promise.all(ORGANIZATION_PRIVACY_INVENTORY.map(async ([key, , listMethod, scope]) => {
    const records = await store[listMethod]?.call(store);
    return [key, scope === "organization"
      ? byOrganization(records, organizationId)
      : scope === "actor_history"
        ? array(records).filter(record => String(record.originalTenantId ?? record.originalRecord?.tenantId ?? "") === organizationId)
        : scoped(records, organizationId)];
  })));
}
function retentionTimestamp(record: any) { return RETENTION_TIMESTAMPS.map(field => validIso(record?.[field])).find(Boolean); }
function privacyTombstone(record: any, candidate: { recordType: string; action: string; reason: string }, runId: string) {
  const tombstone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) if (PRIVACY_AUDIT_FIELDS.has(key)) tombstone[key] = structuredClone(value);
  if (candidate.recordType === "source") Object.assign(tombstone, { name: "Deleted source", url: `privacy://deleted/${record.id}`, accessMethod: "disabled", status: "retired" });
  if (candidate.recordType === "capture") Object.assign(tombstone, { url: `privacy://deleted/${record.id}`, canonicalUrl: `privacy://deleted/${record.id}`, storageKind: "metadata_only" });
  if (candidate.recordType === "incident") Object.assign(tombstone, { title: "Deleted incident", summary: "" });
  if (candidate.recordType === "entity" || candidate.recordType === "indicator") Object.assign(tombstone, { value: `deleted:${record.id}`, normalizedValue: `deleted:${record.id}` });
  if (candidate.recordType === "actor_profile") Object.assign(tombstone, { canonicalName: `Deleted actor ${record.id}`, normalizedName: `deleted:${record.id}`, aliases: [] });
  if (candidate.recordType === "actor_alias") Object.assign(tombstone, { alias: `Deleted alias ${record.id}`, normalizedAlias: `deleted:${record.id}` });
  if (candidate.recordType === "actor_identity") Object.assign(tombstone, { canonicalName: `Deleted actor ${record.id}`, normalizedCanonicalName: `deleted:${record.id}`, associatedNames: [] });
  if (candidate.recordType === "intelligence_claim") Object.assign(tombstone, { value: {}, summary: "" });
  return { ...tombstone, id: record.id, privacyRedactedAt: nowIso(), privacyDeletionRunId: runId, privacyRecordType: candidate.recordType, privacyAction: candidate.action, privacyReason: candidate.reason };
}
function actorHistoryTombstone(record: any, candidate: { recordType: string; action: string; reason: string }, runId: string) {
  const privacyRedactedAt = nowIso();
  return {
    ...record,
    originalRecord: {
      id: record.actorProfileId,
      tenantId: record.originalTenantId,
      privacyRedactedAt,
      privacyDeletionRunId: runId,
      privacyRecordType: "actor_profile_identity_history",
      privacyAction: candidate.action,
      privacyReason: candidate.reason
    },
    referenceSnapshot: { aliases: [], evidenceLinks: [], claims: [], claimEvidence: [], claimReviews: [], workflows: [], privacyRedactedAt, privacyDeletionRunId: runId }
  };
}
function privacyRedacted(record: any, recordType: string) { return Boolean(record.privacyRedactedAt || (recordType === "actor_profile_identity_history" && record.originalRecord?.privacyRedactedAt)); }
function recordReferenceIds(value: any): string[] {
  const ids: string[] = [];
  const visit = (entry: any, key = "") => {
    if (Array.isArray(entry)) { for (const item of entry) visit(item, key); return; }
    if (entry && typeof entry === "object") { for (const [nestedKey, nestedValue] of Object.entries(entry)) visit(nestedValue, nestedKey); return; }
    if (typeof entry === "string" && /Ids?$/.test(key)) ids.push(entry);
  };
  visit(value);
  return unique(ids);
}

function heldCapture(record: any) { return Boolean(record.legalHold || record.retentionClass === "legal_hold" || record.record?.legalHold || record.record?.retentionClass === "legal_hold"); }
function heldClaim(record: any) { return Boolean(record.legalHold || record.retentionClass === "legal_hold"); }
function hasRetainedDeliveryContent(record: any) { return record.payload !== undefined || record.responseBody !== undefined || record.responseSummary !== undefined || record.error !== undefined; }
function scoped(records: any, organizationId: string) { return array(records).filter((row: any) => { const scopes = ownershipScopes(row); return scopes.length > 0 && scopes.every(scope => scope === organizationId); }); }
function byOrganization(records: any, organizationId: string) { return array(records).filter((row: any) => String(row?.organizationId ?? row?.orgId ?? "") === organizationId && ownershipScopes(row).every(scope => scope === organizationId)); }
function ownershipScopes(row: any) { return [row?.tenantId, row?.organizationId, row?.orgId].map(value => String(value ?? "").trim()).filter(Boolean); }
function array(value: any): any[] { return Array.isArray(value) ? value : []; }
function unique(values: string[]) { return [...new Set(values)]; }
function validIso(value: unknown) { const text = String(value ?? ""); return Number.isFinite(Date.parse(text)) ? new Date(text).toISOString() : undefined; }
function boundedLimit(value: unknown) { const number = Number(value ?? 100); return Number.isInteger(number) ? Math.max(1, Math.min(500, number)) : 100; }
function boundedOffset(value: unknown) { const number = Number(value ?? 0); return Number.isInteger(number) ? Math.max(0, number) : 0; }
function oldEnough(record: any, cutoffAt: string, ...fields: string[]) { const at = fields.map(field => validIso(record?.[field])).find(Boolean); return Boolean(at && Date.parse(at!) <= Date.parse(cutoffAt)); }
function item(recordType: string, recordId: unknown, action: PrivacyItem["action"], status: PrivacyItem["status"], reason: string, caught?: unknown): PrivacyItem { return { sourceService: "ti-scraper", recordType, recordId: String(recordId), action, status, reason, ...(caught ? { error: caught instanceof Error ? caught.message : String(caught) } : {}) }; }
function safeRecord(value: any): any { return scrubSecrets(structuredClone(value)); }
function safeDestination(value: any) { const safe = safeRecord(value); for (const key of ["url", "endpoint", "endpointUrl", "webhookUrl", "secret", "token"]) delete safe[key]; return safe; }
function captureExport(capture: any) { return { id: capture.id, tenantId: capture.tenantId, sourceId: capture.sourceId, collectedAt: capture.collectedAt, publishedAt: capture.publishedAt, processedAt: capture.processedAt, firstVisibleAt: capture.firstVisibleAt, contentHash: capture.contentHash, normalizedTextHash: capture.normalizedTextHash, mediaType: capture.mediaType, storageKind: capture.storageKind, sensitive: Boolean(capture.sensitive), retentionClass: capture.retentionClass, legalHold: heldCapture(capture), redaction: capture.redaction, rawBodyIncluded: false, objectReferenceIncluded: false }; }
function scrubSecrets(value: any): any {
  if (Array.isArray(value)) return value.map(scrubSecrets);
  if (!value || typeof value !== "object") return value;
  for (const [key, entry] of Object.entries(value)) {
    if (/(secret|token|credential|password|endpoint_encrypted|authorization)/i.test(key)) value[key] = "[redacted]";
    else value[key] = scrubSecrets(entry);
  }
  return value;
}
