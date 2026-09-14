import { nowIso, stableId } from "../utils.ts";

type CaseStore = {
  getCase(id: string): any;
  saveCase(record: any): any;
  getOrganization(id: string): any;
};
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const strings = (values: unknown[]) => [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())))];

// The retained match is event evidence; the case is the only analyst work item.
// Keep the legacy source type so existing evidence and delivery receipts still resolve.
export function ensureDwmCase(store: CaseStore, event: any): any | undefined {
  if (!event?.id || !event.tenantId) return;
  const organizationId = event.organizationId || event.workflowContext?.organizationId;
  if (event.organizationId && event.workflowContext?.organizationId && event.organizationId !== event.workflowContext.organizationId) return;
  if (organizationId) {
    const organization = store.getOrganization(organizationId);
    if (!organization || organization.status !== "active" || organization.privacyDeletionRunId) return;
    if (event.tenantId !== organizationId && event.tenantId !== organization.tenantId) return;
  }
  const id = event.caseId || event.workflowContext?.caseId || event.caseIdCandidate || event.workflowContext?.caseIdCandidate || stableId("case", `${event.tenantId}:${event.id}`);
  const existing = store.getCase(id);
  if (existing) {
    if (existing.tenantId !== event.tenantId || (existing.organizationId || undefined) !== (organizationId || undefined) || existing.alertId !== event.id) return;
    return existing;
  }
  const evidence = array(event.evidence).filter(Boolean);
  const captureIds = strings([...array(event.provenance?.captureIds), ...array(event.workflowContext?.captureIds), ...evidence.map((item: any) => item.provenance?.captureId ?? item.captureId)]);
  const sourceIds = strings([...array(event.provenance?.sourceIds), ...array(event.workflowContext?.sourceIds), ...evidence.map((item: any) => item.sourceId ?? item.provenance?.sourceId)]);
  const hashes = strings([...array(event.provenance?.contentHashes), ...evidence.map((item: any) => item.contentHash)]);
  if (!captureIds.length || !sourceIds.length || !hashes.length) return;
  const at = event.alertCreatedEvent?.at || event.savedAt || event.createdAt || nowIso();
  const status = (event.workflowStatus === "closed" || ["resolved", "closed"].includes(event.reviewState)) ? "closed"
    : event.workflowStatus === "false_positive" || event.reviewState === "false_positive" ? "false_positive"
    : event.workflowStatus === "suppressed" || event.reviewState === "suppressed" || event.suppressedAt ? "suppressed"
    : event.workflowStatus === "investigating" ? "in_progress" : "open";
  const note = event.workflowNote || event.decisionRationale || "Created automatically from a monitoring event.";
  return store.saveCase({
    id, tenantId: event.tenantId, organizationId, sourceType: "dwm_alert", sourceId: event.id, alertId: event.id,
    title: String(event.company || event.matchedTerm?.value || "Monitoring finding"),
    summary: String(event.claimSummary || "A monitored event needs review."),
    priority: ["low", "medium", "high", "critical"].includes(event.severityOverride || event.severity) ? event.severityOverride || event.severity : "medium",
    status, assignedOwner: event.assignedOwner, createdAt: at, updatedAt: event.updatedAt || at,
    workflowEvents: [{ id: `${id}:automatic-open`, at, actor: "Monitoring", action: "open", toStatus: status, note }, ...array(event.workflowEvents)],
    lastDecision: note, deliveryState: event.deliveryState,
    ...(status === "closed" ? { closedAt: event.closedAt || event.updatedAt || at, resolution: { id: `${id}:resolution`, type: "unknown", at: event.closedAt || event.updatedAt || at, note } } : {}),
  });
}
