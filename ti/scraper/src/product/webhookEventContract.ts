import { stableId, uniqueStrings } from "../utils.ts";

export const DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION = "dwm.webhook_event_contract.v1" as const;
export const DWM_WEBHOOK_EVENT_CHAIN_SCHEMA_VERSION = "dwm.webhook_event_chain.v1" as const;
export const DWM_WEBHOOK_EVENT_SUPPORT_HANDOFF_SCHEMA_VERSION = "dwm.webhook_event_support_handoff.v1" as const;
export const DWM_WEBHOOK_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION = "dwm.webhook_support_action_request.v1" as const;

export type DwmWebhookEventKind = "webhook.delivery_recorded" | "case.customer_notification_recorded";

export type DwmWebhookEventContract = {
  schemaVersion: typeof DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION;
  id: string;
  eventKind: DwmWebhookEventKind;
  occurredAt: string;
  tenantId: string;
  organizationId?: string;
  alertId: string;
  caseId?: string;
  dedupeKey?: string;
  idempotencyKey?: string;
  webhookDeliveryId?: string;
  webhookDestinationId?: string;
  status?: string;
  actor?: string;
  route?: string;
  delivery?: {
    deliveryKind?: string;
    httpStatus?: number;
    dryRun?: boolean;
    endpointHash?: string;
    payloadHash?: string;
  };
  customerNotification?: {
    deliveryMode?: string;
    externalReference?: string;
    rationale?: string;
  };
  evidence: {
    evidenceCount: number;
    captureIds: string[];
    sourceIds: string[];
    contentHashes: string[];
  };
};

export type DwmWebhookEventChain = {
  schemaVersion: typeof DWM_WEBHOOK_EVENT_CHAIN_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  blockers: DwmWebhookEventChainBlocker[];
  identity?: {
    tenantId: string;
    organizationId?: string;
    alertId: string;
    caseId?: string;
    webhookDeliveryId?: string;
    webhookDestinationId?: string;
    dedupeKey?: string;
  };
  events: DwmWebhookEventContract[];
};

export type DwmWebhookEventChainBlocker = {
  code:
    | "missing_delivery_event"
    | "missing_customer_notification_event"
    | "delivery_not_delivered"
    | "dry_run_delivery"
    | "identity_mismatch"
    | "notification_delivery_mismatch"
    | "missing_case_id"
    | "missing_provenance";
  ownerLane: "webhook" | "case" | "source";
  message: string;
  path: string;
};

export type DwmWebhookEventSupportHandoff = {
  schemaVersion: typeof DWM_WEBHOOK_EVENT_SUPPORT_HANDOFF_SCHEMA_VERSION;
  id: string;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  alertId: string;
  caseId?: string;
  webhookDeliveryId?: string;
  webhookDestinationId?: string;
  helpdesk: {
    redacted: true;
    lookupKey: string;
    supportAction: "inspect_webhook_delivery" | "restore_webhook_delivery_chain";
    routeHints: {
      caseDetail?: string;
      alertDetail?: string;
      webhookDelivery?: string;
    };
    customerVisible: false;
  };
  audit: {
    eventType: "dwm.webhook.customer_notification_chain_checked";
    outcome: "verified" | "blocked";
    actorIds: string[];
    deliveryMode?: string;
    deliveryKind?: string;
    blockerCodes: DwmWebhookEventChainBlocker["code"][];
    ownerLanes: DwmWebhookEventChainBlocker["ownerLane"][];
  };
  evidence: {
    redacted: true;
    evidenceCount: number;
    captureIds: string[];
    sourceIds: string[];
    contentHashes: string[];
    endpointHash?: string;
    payloadHash?: string;
  };
  nextActions: {
    ownerLane: DwmWebhookEventChainBlocker["ownerLane"];
    action: "record_delivery" | "record_customer_notification" | "retry_delivery" | "record_live_delivery" | "attach_case" | "restore_provenance" | "resolve_identity";
    blockerCode: DwmWebhookEventChainBlocker["code"];
    path: string;
  }[];
};

export type DwmWebhookSupportActionRequest = {
  schemaVersion: typeof DWM_WEBHOOK_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  adminSupportContract: {
    schemaVersion: "support.action_prepare.v1";
    method: "GET";
    route: "/api/admin/support/inspect";
    query: {
      org?: string;
      entity?: string;
      entityType: "dwm_webhook_delivery";
      action: "support.webhook.inspect_delivery" | "support.webhook.restore_delivery_chain";
      prepareAction: "inspect_webhook_delivery" | "restore_webhook_delivery_chain";
      requestId?: string;
      idempotencyKey: string;
    };
  };
  target: {
    tenantId: string;
    organizationId?: string;
    alertId: string;
    caseId?: string;
    webhookDeliveryId?: string;
    webhookDestinationId?: string;
  };
  redaction: {
    required: true;
    attestation: "support_safe_metadata_only";
    hiddenFields: string[];
  };
  auditPreview: {
    actionType: "support.webhook.inspect_delivery" | "support.webhook.restore_delivery_chain";
    source: "dwm.webhook_event_support_handoff";
    outcome: "prepared" | "blocked";
    blockerCodes: DwmWebhookEventChainBlocker["code"][];
    supportAction: DwmWebhookEventSupportHandoff["helpdesk"]["supportAction"];
  };
  blockers: {
    code: "handoff_blocked" | "missing_support_target";
    ownerLane: "webhook" | "case" | "source";
    path: string;
    message: string;
  }[];
};

export function buildWebhookDeliveryEventContract(input: {
  delivery: Record<string, any>;
  alert?: Record<string, any>;
  caseId?: string;
  actor?: string;
  occurredAt?: string;
}): DwmWebhookEventContract {
  const delivery = input.delivery;
  const alert = input.alert ?? {};
  const alertId = stringValue(delivery.alertId ?? alert.id) ?? "";
  const caseId = stringValue(input.caseId ?? delivery.caseId ?? alert.caseId ?? alert.caseIdCandidate);
  const evidence = evidenceFromAlertAndDelivery(alert, delivery);
  return {
    schemaVersion: DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION,
    id: stableId("dwm_webhook_event", `delivery:${delivery.id ?? ""}:${alertId}:${delivery.status ?? ""}`),
    eventKind: "webhook.delivery_recorded",
    occurredAt: stringValue(input.occurredAt ?? delivery.attemptedAt ?? delivery.createdAt ?? alert.updatedAt) || new Date(0).toISOString(),
    tenantId: stringValue(delivery.tenantId ?? alert.tenantId) ?? "",
    organizationId: stringValue(delivery.organizationId ?? alert.organizationId ?? alert.workflowContext?.organizationId ?? alert.webhookContext?.organizationId),
    alertId,
    caseId,
    dedupeKey: stringValue(delivery.dedupeKey ?? alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.workflowContext?.dedupeKey),
    idempotencyKey: stringValue(delivery.idempotencyKey ?? alert.webhookContext?.idempotencyKey ?? alert.workflowContext?.idempotencyKey),
    webhookDeliveryId: stringValue(delivery.id),
    webhookDestinationId: stringValue(delivery.webhookDestinationId),
    status: stringValue(delivery.status),
    actor: stringValue(input.actor ?? delivery.actor ?? delivery.createdBy),
    route: caseId ? `/v1/cases/${encodeURIComponent(caseId)}` : undefined,
    delivery: {
      deliveryKind: stringValue(delivery.deliveryKind),
      httpStatus: typeof delivery.httpStatus === "number" ? delivery.httpStatus : undefined,
      dryRun: Boolean(delivery.dryRun),
      endpointHash: stringValue(delivery.endpointHash),
      payloadHash: stringValue(delivery.payloadHash)
    },
    evidence
  };
}

export function buildCaseCustomerNotificationEventContract(input: {
  receipt: Record<string, any>;
  caseRecord?: Record<string, any>;
  alert?: Record<string, any>;
}): DwmWebhookEventContract {
  const receipt = input.receipt;
  const caseRecord = input.caseRecord ?? {};
  const alert = input.alert ?? {};
  const alertId = stringValue(receipt.alertId ?? caseRecord.alertId ?? alert.id) ?? "";
  const caseId = stringValue(receipt.caseId ?? caseRecord.id);
  const evidence = evidenceFromReceiptCaseAndAlert(receipt, caseRecord, alert);
  return {
    schemaVersion: DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION,
    id: stableId("dwm_webhook_event", `customer_notification:${receipt.id ?? ""}:${caseId}:${receipt.webhookDeliveryId ?? receipt.externalReference ?? ""}`),
    eventKind: "case.customer_notification_recorded",
    occurredAt: stringValue(receipt.at ?? receipt.createdAt ?? caseRecord.updatedAt) || new Date(0).toISOString(),
    tenantId: stringValue(receipt.tenantId ?? caseRecord.tenantId ?? alert.tenantId) ?? "",
    organizationId: stringValue(receipt.organizationId ?? caseRecord.organizationId ?? alert.organizationId),
    alertId,
    caseId,
    dedupeKey: stringValue(receipt.dedupeKey ?? alert.dedupeKey ?? alert.webhookDelivery?.dedupeKey ?? alert.workflowContext?.dedupeKey),
    idempotencyKey: stringValue(receipt.idempotencyKey),
    webhookDeliveryId: stringValue(receipt.webhookDeliveryId),
    webhookDestinationId: stringValue(receipt.webhookDestinationId),
    status: stringValue(receipt.webhookStatus),
    actor: stringValue(receipt.actor ?? receipt.createdBy),
    route: caseId ? `/v1/cases/${encodeURIComponent(caseId)}` : undefined,
    customerNotification: {
      deliveryMode: stringValue(receipt.deliveryMode),
      externalReference: stringValue(receipt.externalReference),
      rationale: stringValue(receipt.rationale)
    },
    evidence
  };
}

export function validateWebhookEventChain(input: {
  deliveryEvent?: DwmWebhookEventContract;
  customerNotificationEvent?: DwmWebhookEventContract;
  checkedAt?: string;
}): DwmWebhookEventChain {
  const blockers: DwmWebhookEventChainBlocker[] = [];
  const delivery = input.deliveryEvent;
  const notification = input.customerNotificationEvent;

  if (!delivery) blockers.push(blocker("missing_delivery_event", "webhook", "deliveryEvent", "Webhook delivery event is required."));
  if (!notification) blockers.push(blocker("missing_customer_notification_event", "case", "customerNotificationEvent", "Customer notification event is required."));

  if (delivery) {
    if (delivery.status !== "delivered") blockers.push(blocker("delivery_not_delivered", "webhook", "deliveryEvent.status", "Webhook delivery must be delivered."));
    if (delivery.delivery?.dryRun) blockers.push(blocker("dry_run_delivery", "webhook", "deliveryEvent.delivery.dryRun", "Dry-run delivery cannot prove customer notification."));
    if (!delivery.caseId) blockers.push(blocker("missing_case_id", "case", "deliveryEvent.caseId", "Webhook delivery event must resolve to a case id."));
    if (!hasProvenance(delivery)) blockers.push(blocker("missing_provenance", "source", "deliveryEvent.evidence", "Webhook delivery event must retain evidence provenance."));
  }

  if (notification) {
    if (!notification.caseId) blockers.push(blocker("missing_case_id", "case", "customerNotificationEvent.caseId", "Customer notification must reference a case id."));
    if (!hasProvenance(notification)) blockers.push(blocker("missing_provenance", "source", "customerNotificationEvent.evidence", "Customer notification must retain evidence provenance."));
  }

  if (delivery && notification) {
    for (const [path, left, right] of [
      ["tenantId", delivery.tenantId, notification.tenantId],
      ["organizationId", delivery.organizationId, notification.organizationId],
      ["alertId", delivery.alertId, notification.alertId],
      ["caseId", delivery.caseId, notification.caseId],
      ["webhookDestinationId", delivery.webhookDestinationId, notification.webhookDestinationId]
    ] as const) {
      if (left && right && left !== right) blockers.push(blocker("identity_mismatch", path === "webhookDestinationId" ? "webhook" : "case", path, `Webhook event ${path} does not match customer notification.`));
    }
    if (notification.webhookDeliveryId && delivery.webhookDeliveryId && notification.webhookDeliveryId !== delivery.webhookDeliveryId) {
      blockers.push(blocker("notification_delivery_mismatch", "case", "customerNotificationEvent.webhookDeliveryId", "Customer notification references a different webhook delivery."));
    }
  }

  const identitySource = notification ?? delivery;
  return {
    schemaVersion: DWM_WEBHOOK_EVENT_CHAIN_SCHEMA_VERSION,
    checkedAt: input.checkedAt ?? new Date(0).toISOString(),
    ok: blockers.length === 0,
    blockers,
    identity: identitySource ? {
      tenantId: identitySource.tenantId,
      organizationId: identitySource.organizationId,
      alertId: identitySource.alertId,
      caseId: identitySource.caseId,
      webhookDeliveryId: identitySource.webhookDeliveryId,
      webhookDestinationId: identitySource.webhookDestinationId,
      dedupeKey: identitySource.dedupeKey
    } : undefined,
    events: [delivery, notification].filter((event): event is DwmWebhookEventContract => Boolean(event))
  };
}

export function buildWebhookEventSupportHandoff(input: {
  chain: DwmWebhookEventChain;
  checkedAt?: string;
}): DwmWebhookEventSupportHandoff {
  const chain = input.chain;
  const delivery = chain.events.find((event) => event.eventKind === "webhook.delivery_recorded");
  const notification = chain.events.find((event) => event.eventKind === "case.customer_notification_recorded");
  const identity = chain.identity;
  const tenantId = identity?.tenantId ?? notification?.tenantId ?? delivery?.tenantId ?? "";
  const organizationId = identity?.organizationId ?? notification?.organizationId ?? delivery?.organizationId;
  const alertId = identity?.alertId ?? notification?.alertId ?? delivery?.alertId ?? "";
  const caseId = identity?.caseId ?? notification?.caseId ?? delivery?.caseId;
  const webhookDeliveryId = identity?.webhookDeliveryId ?? notification?.webhookDeliveryId ?? delivery?.webhookDeliveryId;
  const webhookDestinationId = identity?.webhookDestinationId ?? notification?.webhookDestinationId ?? delivery?.webhookDestinationId;
  const blockerCodes = chain.blockers.map((item) => item.code);
  const ownerLanes = uniqueStrings(chain.blockers.map((item) => item.ownerLane)) as DwmWebhookEventChainBlocker["ownerLane"][];

  return {
    schemaVersion: DWM_WEBHOOK_EVENT_SUPPORT_HANDOFF_SCHEMA_VERSION,
    id: stableId("dwm_webhook_event_support_handoff", `${tenantId}:${organizationId ?? ""}:${alertId}:${caseId ?? ""}:${webhookDeliveryId ?? ""}:${blockerCodes.join(",")}`),
    checkedAt: input.checkedAt ?? chain.checkedAt,
    ok: chain.ok,
    tenantId,
    organizationId,
    alertId,
    caseId,
    webhookDeliveryId,
    webhookDestinationId,
    helpdesk: {
      redacted: true,
      lookupKey: organizationId ?? tenantId,
      supportAction: chain.ok ? "inspect_webhook_delivery" : "restore_webhook_delivery_chain",
      routeHints: {
        caseDetail: caseId ? `/v1/cases/${encodeURIComponent(caseId)}` : undefined,
        alertDetail: alertId ? `/v1/dwm/alerts/${encodeURIComponent(alertId)}` : undefined,
        webhookDelivery: webhookDeliveryId ? `/v1/dwm/webhook-deliveries/${encodeURIComponent(webhookDeliveryId)}` : undefined
      },
      customerVisible: false
    },
    audit: {
      eventType: "dwm.webhook.customer_notification_chain_checked",
      outcome: chain.ok ? "verified" : "blocked",
      actorIds: uniqueStrings(chain.events.map((event) => event.actor).filter(Boolean).map(String)),
      deliveryMode: notification?.customerNotification?.deliveryMode,
      deliveryKind: delivery?.delivery?.deliveryKind,
      blockerCodes,
      ownerLanes
    },
    evidence: {
      redacted: true,
      evidenceCount: maxEvidenceCount(chain.events),
      captureIds: uniqueStrings(chain.events.flatMap((event) => event.evidence.captureIds)),
      sourceIds: uniqueStrings(chain.events.flatMap((event) => event.evidence.sourceIds)),
      contentHashes: uniqueStrings(chain.events.flatMap((event) => event.evidence.contentHashes)),
      endpointHash: delivery?.delivery?.endpointHash,
      payloadHash: delivery?.delivery?.payloadHash
    },
    nextActions: chain.blockers.map((item) => ({
      ownerLane: item.ownerLane,
      action: supportActionFor(item.code),
      blockerCode: item.code,
      path: item.path
    }))
  };
}

export function buildWebhookSupportActionRequest(input: {
  handoff: DwmWebhookEventSupportHandoff;
  requestId?: string;
  generatedAt?: string;
}): DwmWebhookSupportActionRequest {
  const handoff = input.handoff;
  const actionType = handoff.helpdesk.supportAction === "inspect_webhook_delivery"
    ? "support.webhook.inspect_delivery"
    : "support.webhook.restore_delivery_chain";
  const idempotencyKey = stableId("dwm_webhook_support_action", `${handoff.id}:${actionType}:${input.requestId ?? ""}`);
  const blockers = supportRequestBlockers(handoff);

  return {
    schemaVersion: DWM_WEBHOOK_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
    id: stableId("dwm_webhook_support_action_request", `${handoff.id}:${input.requestId ?? ""}`),
    generatedAt: input.generatedAt ?? handoff.checkedAt,
    ok: blockers.length === 0,
    adminSupportContract: {
      schemaVersion: "support.action_prepare.v1",
      method: "GET",
      route: "/api/admin/support/inspect",
      query: {
        org: handoff.organizationId,
        entity: handoff.webhookDeliveryId,
        entityType: "dwm_webhook_delivery",
        action: actionType,
        prepareAction: handoff.helpdesk.supportAction,
        requestId: stringValue(input.requestId),
        idempotencyKey
      }
    },
    target: {
      tenantId: handoff.tenantId,
      organizationId: handoff.organizationId,
      alertId: handoff.alertId,
      caseId: handoff.caseId,
      webhookDeliveryId: handoff.webhookDeliveryId,
      webhookDestinationId: handoff.webhookDestinationId
    },
    redaction: {
      required: true,
      attestation: "support_safe_metadata_only",
      hiddenFields: ["endpointUrl", "payloadBody", "rawEvidence", "customerRationale"]
    },
    auditPreview: {
      actionType,
      source: "dwm.webhook_event_support_handoff",
      outcome: blockers.length === 0 ? "prepared" : "blocked",
      blockerCodes: handoff.audit.blockerCodes,
      supportAction: handoff.helpdesk.supportAction
    },
    blockers
  };
}

function evidenceFromAlertAndDelivery(alert: Record<string, any>, delivery: Record<string, any>): DwmWebhookEventContract["evidence"] {
  const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
  return {
    evidenceCount: Number(alert.workflowContext?.evidenceCount ?? alert.webhookContext?.evidenceCount ?? evidence.length ?? 0),
    captureIds: uniqueStrings([...(alert.provenance?.captureIds ?? []), ...(alert.workflowContext?.captureIds ?? []), ...(alert.webhookContext?.captureIds ?? []), ...(delivery.captureIds ?? [])].map(String)),
    sourceIds: uniqueStrings(evidence.map((row: any) => row.sourceId).filter(Boolean).map(String)),
    contentHashes: uniqueStrings(evidence.map((row: any) => row.contentHash).filter(Boolean).map(String))
  };
}

function evidenceFromReceiptCaseAndAlert(receipt: Record<string, any>, caseRecord: Record<string, any>, alert: Record<string, any>): DwmWebhookEventContract["evidence"] {
  const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
  return {
    evidenceCount: Number(receipt.evidence?.evidenceCount ?? evidence.length ?? 0),
    captureIds: uniqueStrings([...(receipt.evidence?.captureIds ?? []), ...(alert.provenance?.captureIds ?? [])].map(String)),
    sourceIds: uniqueStrings([...(receipt.evidence?.sourceIds ?? []), ...evidence.map((row: any) => row.sourceId)].filter(Boolean).map(String)),
    contentHashes: uniqueStrings([...(receipt.evidence?.contentHashes ?? []), ...evidence.map((row: any) => row.contentHash)].filter(Boolean).map(String))
  };
}

function hasProvenance(event: DwmWebhookEventContract): boolean {
  return event.evidence.evidenceCount > 0 || event.evidence.captureIds.length > 0 || event.evidence.sourceIds.length > 0 || event.evidence.contentHashes.length > 0;
}

function maxEvidenceCount(events: DwmWebhookEventContract[]): number {
  return events.reduce((max, event) => Math.max(max, event.evidence.evidenceCount), 0);
}

function supportActionFor(code: DwmWebhookEventChainBlocker["code"]): DwmWebhookEventSupportHandoff["nextActions"][number]["action"] {
  if (code === "missing_delivery_event") return "record_delivery";
  if (code === "missing_customer_notification_event") return "record_customer_notification";
  if (code === "delivery_not_delivered") return "retry_delivery";
  if (code === "dry_run_delivery") return "record_live_delivery";
  if (code === "missing_case_id") return "attach_case";
  if (code === "missing_provenance") return "restore_provenance";
  return "resolve_identity";
}

function supportRequestBlockers(handoff: DwmWebhookEventSupportHandoff): DwmWebhookSupportActionRequest["blockers"] {
  const blockers: DwmWebhookSupportActionRequest["blockers"] = [];
  if (!handoff.organizationId || !handoff.webhookDeliveryId) {
    blockers.push({
      code: "missing_support_target",
      ownerLane: "webhook",
      path: !handoff.organizationId ? "handoff.organizationId" : "handoff.webhookDeliveryId",
      message: "Support action preparation requires organization and webhook delivery identity."
    });
  }
  if (!handoff.ok) {
    blockers.push(...handoff.nextActions.map((action) => ({
      code: "handoff_blocked" as const,
      ownerLane: action.ownerLane,
      path: action.path,
      message: "Webhook support handoff has unresolved blockers."
    })));
  }
  return blockers;
}

function blocker(code: DwmWebhookEventChainBlocker["code"], ownerLane: DwmWebhookEventChainBlocker["ownerLane"], path: string, message: string): DwmWebhookEventChainBlocker {
  return { code, ownerLane, path, message };
}

function stringValue(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}
