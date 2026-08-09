import { syncAutomaticReviewQueue } from "./automaticReviewRoutes.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";

type Observation = {
  status: "up" | "down";
  checkedAt: string;
  latencyMs: number;
  message: string;
  consecutiveFailures: number;
};

export type ServiceMonitorIncidentInput = {
  service: string;
  checkName: string;
  status: "up" | "down";
  checkedAt: string;
  latencyMs: number;
  message?: string;
  consecutiveFailures: number;
  incidentStartedAt: string;
  observations: Observation[];
};

export async function upsertServiceMonitorIncident(options: ApiServerOptions, input: ServiceMonitorIncidentInput) {
  const store = options.store as any;
  const service = boundedText(input.service, 120);
  const checkName = boundedText(input.checkName, 160);
  const checkedAt = validIso(input.checkedAt);
  const incidentStartedAt = validIso(input.incidentStartedAt);
  if (!service || !checkName || !checkedAt || !incidentStartedAt) throw new Error("Service monitor incident requires bounded service and timestamps");
  if (input.status === "down" && input.consecutiveFailures < 3) return { incident: undefined, queued: 0 };

  const open = (store.listIncidents?.() ?? []).find((incident: any) => {
    const monitor = incident.record?.serviceMonitor;
    return monitor?.service === service && monitor?.checkName === checkName && monitor.state === "open";
  });
  if (input.status === "up" && !open) return { incident: undefined, queued: 0 };

  const sourceId = stableId("service-monitor-source", `${service}:${checkName}`);
  const source = store.getSource?.(sourceId);
  const at = nowIso();
  if (!source) {
    store.saveSource({
      id: sourceId,
      name: `${service} service monitor`,
      type: "service_monitor",
      url: "https://hanasand.com/status",
      accessMethod: "internal",
      status: "active",
      risk: "low",
      trustScore: 1,
      crawlFrequencySeconds: 60,
      legalNotes: "Internal operational monitor evidence.",
      metadata: { sourceFamily: "service_monitor", service, checkName },
      createdAt: at,
      updatedAt: at,
    });
  }

  const observations = input.observations.length ? input.observations : [{
    status: input.status,
    checkedAt,
    latencyMs: input.latencyMs,
    message: input.message ?? "",
    consecutiveFailures: input.consecutiveFailures,
  }];
  const captures = observations.map((observation) => {
    const observationAt = validIso(observation.checkedAt) ?? checkedAt;
    const message = boundedText(observation.message, 1_000);
    const body = `${service} / ${checkName}: ${observation.status}; checked ${observationAt}; latency ${Math.max(0, Number(observation.latencyMs) || 0)} ms; consecutive failures ${Math.max(0, Number(observation.consecutiveFailures) || 0)}${message ? `; error ${message}` : ""}`;
    const id = stableId("service-monitor-capture", `${sourceId}:${observationAt}:${observation.status}:${observation.latencyMs}:${message}:${observation.consecutiveFailures}`);
    return {
      id,
      sourceId,
      url: "https://hanasand.com/status",
      title: `${service} / ${checkName} ${observation.status}`,
      collectedAt: observationAt,
      publishedAt: observationAt,
      processedAt: at,
      firstVisibleAt: at,
      contentHash: hashContent(body),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body,
      metadata: {
        safeExcerpt: body,
        sourceFamily: "service_monitor",
        service,
        checkName,
        status: observation.status,
        latencyMs: Math.max(0, Number(observation.latencyMs) || 0),
        error: message || undefined,
        consecutiveFailures: Math.max(0, Number(observation.consecutiveFailures) || 0),
      },
      provenance: { extractorVersion: "service-monitor:v1", parserVersion: "service-monitor:v1" },
      sensitive: false,
    };
  });
  for (const capture of captures) store.saveCapture(capture);

  const incidentId = open?.id ?? stableId("service-monitor-incident", `${service}:${checkName}:${incidentStartedAt}`);
  const previousMonitor = open?.record?.serviceMonitor ?? {};
  const evidenceCount = (store.listEvidenceLinks?.() ?? []).filter((link: any) => link.subjectType === "incident" && link.subjectId === incidentId).length + captures.filter((capture) => !(store.listEvidenceLinks?.() ?? []).some((link: any) => link.captureId === capture.id && link.subjectId === incidentId)).length;
  const monitor = {
    schemaVersion: "hanasand.service_monitor_incident.v1",
    service,
    checkName,
    state: input.status === "up" ? "resolved" : "open",
    firstDownAt: open?.record?.serviceMonitor?.firstDownAt ?? incidentStartedAt,
    lastCheckedAt: checkedAt,
    lastStatus: input.status,
    lastLatencyMs: Math.max(0, Number(input.latencyMs) || 0),
    lastError: input.status === "down" ? boundedText(input.message, 1_000) || undefined : previousMonitor.lastError,
    consecutiveFailures: Math.max(0, Number(input.consecutiveFailures) || 0),
    recoveryAt: input.status === "up" ? checkedAt : undefined,
    evidenceCount,
  };
  const incident = store.saveIncident({
    ...(open ?? {}),
    id: incidentId,
    sourceId,
    captureId: captures.at(-1)!.id,
    title: `${checkName} outage`,
    summary: input.status === "up"
      ? `${checkName} recovered at ${checkedAt} after ${previousMonitor.consecutiveFailures ?? input.consecutiveFailures} consecutive failures.`
      : `${checkName} is unavailable after ${input.consecutiveFailures} consecutive failures.`,
    firstSeenAt: open?.firstSeenAt ?? incidentStartedAt,
    collectedAt: checkedAt,
    processedAt: at,
    firstVisibleAt: at,
    confidence: 1,
    extractorVersion: "service-monitor:v1",
    reviewState: open?.reviewState ?? "unreviewed",
    reviewReasons: open?.reviewReasons ?? ["service_monitor_down"],
    record: { ...(open?.record ?? {}), serviceMonitor: monitor },
    updatedAt: at,
  });
  for (const capture of captures) {
    store.saveEvidenceLink({
      id: stableId("service-monitor-evidence", `${incidentId}:${capture.id}`),
      subjectType: "incident",
      subjectId: incidentId,
      captureId: capture.id,
      sourceId,
      relationship: input.status === "up" ? "recovery" : "supports",
      evidenceStage: "service_monitor_check",
      confidence: 1,
      extractorVersion: "service-monitor:v1",
      createdAt: capture.collectedAt,
    });
  }
  const queued = input.status === "up" ? 0 : await syncAutomaticReviewQueue(options, { allTenants: true, now: checkedAt });
  return { incident, queued };
}

function boundedText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validIso(value: unknown) {
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}
