import {
  buildRestrictedMetadataApplyPlan,
  buildRestrictedMetadataCutoverReport,
  buildRestrictedMetadataOperationsStatus,
  DARKNET_METADATA_NETWORK_CONFIGS,
  restrictedMetadataApplyPlanApiContract,
  type ApprovedProxyBoundary,
  type DarknetNetwork,
  type RestrictedMetadataApplyAction,
  type RestrictedMetadataApplyPlan,
  type RestrictedMetadataApplyPlanItem
} from "../adapters/darknetMetadata.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";

export interface RestrictedMetadataApplyPlanRequestDto {
  sourceIds?: string[];
  operatorId?: string;
  retentionExpiringWithinDays?: number;
  includeCutover?: boolean;
  actions?: string[];
}

export interface RestrictedMetadataApplyPlanRouteOptions {
  store: ScraperStore;
  generatedAt?: string;
}

export interface RestrictedMetadataStatusRequestDto {
  sourceIds?: string[];
  operatorId?: string;
  runId?: string;
}

export interface RestrictedMetadataStatusRouteOptions {
  store: ScraperStore;
  generatedAt?: string;
}

export type RestrictedMetadataApplyPlanRouteResult =
  | {
    ok: true;
    body: {
      contract: ReturnType<typeof restrictedMetadataApplyPlanApiContract>;
      applyPlan: RestrictedMetadataApplyPlan;
      cutoverReport?: ReturnType<typeof buildRestrictedMetadataCutoverReport>;
    };
  }
  | {
    ok: false;
    status: 400;
    code: "invalid_action";
    message: string;
    details: {
      allowedActions: RestrictedMetadataApplyAction[];
      invalidActions: string[];
    };
  };

const RESTRICTED_METADATA_APPLY_ACTIONS: RestrictedMetadataApplyAction[] = [
  "enable_metadata_only_queue",
  "disable_source",
  "renew_legal_notes",
  "approve_proxy_isolation",
  "apply_kill_switch",
  "shorten_retention",
  "keep_source_blocked"
];

export function buildRestrictedMetadataApplyPlanRouteResponse(
  input: RestrictedMetadataApplyPlanRequestDto,
  options: RestrictedMetadataApplyPlanRouteOptions
): RestrictedMetadataApplyPlanRouteResult {
  const invalidActions = (input.actions ?? []).filter((action) => !RESTRICTED_METADATA_APPLY_ACTIONS.includes(action as RestrictedMetadataApplyAction));
  if (invalidActions.length > 0) {
    return {
      ok: false,
      status: 400,
      code: "invalid_action",
      message: "Unsupported restricted-metadata apply-plan action",
      details: {
        allowedActions: RESTRICTED_METADATA_APPLY_ACTIONS,
        invalidActions
      }
    };
  }

  const generatedAt = options.generatedAt ?? nowIso();
  const selectedSourceIds = new Set(input.sourceIds ?? []);
  const sources = options.store
    .listSources()
    .filter((source) => source.type.endsWith("_metadata"))
    .filter((source) => selectedSourceIds.size === 0 || selectedSourceIds.has(source.id));
  const proxyBoundaries = proxyBoundariesForSources(sources);
  const plan = buildRestrictedMetadataApplyPlan({
    sources,
    proxyBoundaries,
    scheduler: { queuedSourceIds: sources.filter(canPreviewMetadataOnlyQueue).map((source) => source.id) },
    generatedAt,
    operatorId: input.operatorId,
    retentionExpiringWithinDays: input.retentionExpiringWithinDays
  });
  const selectedActions = new Set((input.actions ?? []) as RestrictedMetadataApplyAction[]);
  const applyPlan = apiSafeRestrictedMetadataApplyPlan(selectedActions.size > 0 ? filterRestrictedMetadataApplyPlan(plan, selectedActions) : plan);

  return {
    ok: true,
    body: {
      contract: restrictedMetadataApplyPlanApiContract(),
      applyPlan,
      cutoverReport: input.includeCutover
        ? buildRestrictedMetadataCutoverReport({
          sources,
          proxyBoundaries,
          scheduler: { queuedSourceIds: sources.filter(canPreviewMetadataOnlyQueue).map((source) => source.id) },
          generatedAt,
          retentionExpiringWithinDays: input.retentionExpiringWithinDays
        })
        : undefined
    }
  };
}

export function buildRestrictedMetadataStatusRouteResponse(
  input: RestrictedMetadataStatusRequestDto,
  options: RestrictedMetadataStatusRouteOptions
) {
  const generatedAt = options.generatedAt ?? nowIso();
  const selectedSourceIds = new Set(input.sourceIds ?? []);
  const sources = options.store
    .listSources()
    .filter((source) => source.type.endsWith("_metadata"))
    .filter((source) => selectedSourceIds.size === 0 || selectedSourceIds.has(source.id));

  return {
    ok: true as const,
    body: {
      status: buildRestrictedMetadataOperationsStatus({
        sources,
        captures: options.store.listCaptures(),
        proxyBoundaries: proxyBoundariesForSources(sources),
        generatedAt,
        operatorId: input.operatorId,
        runId: input.runId
      })
    }
  };
}

function filterRestrictedMetadataApplyPlan(
  applyPlan: RestrictedMetadataApplyPlan,
  selectedActions: Set<RestrictedMetadataApplyAction>
): RestrictedMetadataApplyPlan {
  return summarizeRestrictedMetadataApplyPlan({
    ...applyPlan,
    actions: applyPlan.actions.filter((action) => selectedActions.has(action.action))
  });
}

function summarizeRestrictedMetadataApplyPlan(applyPlan: RestrictedMetadataApplyPlan): RestrictedMetadataApplyPlan {
  const count = (predicate: (action: RestrictedMetadataApplyPlanItem) => boolean) => applyPlan.actions.filter(predicate).length;
  return {
    ...applyPlan,
    summary: {
      automation_safe: count((action) => action.safety === "automation_safe"),
      human_approval_required: count((action) => action.safety === "human_approval_required"),
      blocked: count((action) => action.safety === "blocked"),
      rollback_only: count((action) => action.safety === "rollback_only")
    }
  };
}

function apiSafeRestrictedMetadataApplyPlan(applyPlan: RestrictedMetadataApplyPlan): RestrictedMetadataApplyPlan {
  return {
    ...applyPlan,
    analystOperations: {
      ...applyPlan.analystOperations,
      packets: applyPlan.analystOperations.packets.map((packet) => ({
        ...packet,
        whatWasNotAccessed: packet.whatWasNotAccessed.map((value) => value === "raw leaked files" ? "restricted files" : value)
      }))
    }
  };
}

function proxyBoundariesForSources(sources: readonly SourceRecord[]): Partial<Record<DarknetNetwork, ApprovedProxyBoundary>> {
  const networks = new Set(sources.map((source) => networkForSource(source)).filter((network): network is DarknetNetwork => Boolean(network)));
  return Object.fromEntries(Array.from(networks).map((network) => [
    network,
    {
      id: `${network}-approved-metadata-proxy`,
      network,
      accessMethod: "approved_proxy",
      config: {
        ...DARKNET_METADATA_NETWORK_CONFIGS[network],
        proxyBoundaryId: `${network}-approved-metadata-proxy`
      },
      health: {
        boundaryId: `${network}-approved-metadata-proxy`,
        network,
        proxyType: DARKNET_METADATA_NETWORK_CONFIGS[network].proxyType,
        isolationId: `${network}:${network}-approved-metadata-proxy:metadata-only`,
        healthy: true,
        checkedAt: nowIso(),
        timeoutClass: DARKNET_METADATA_NETWORK_CONFIGS[network].timeoutClass,
        resolutionFailure: "none",
        fetchFailure: "none",
        screenshotHashMode: DARKNET_METADATA_NETWORK_CONFIGS[network].screenshotHashMode
      },
      async fetchMetadata() {
        return {};
      }
    } satisfies ApprovedProxyBoundary
  ]));
}

function networkForSource(source: SourceRecord): DarknetNetwork | undefined {
  if (source.type === "tor_metadata") return "tor";
  if (source.type === "i2p_metadata") return "i2p";
  if (source.type === "freenet_metadata") return "freenet";
  return undefined;
}

function canPreviewMetadataOnlyQueue(source: SourceRecord): boolean {
  return source.status === "active" &&
    source.accessMethod === "approved_proxy" &&
    source.governance?.approvalState === "approved" &&
    source.governance.metadataOnly === true &&
    Boolean(source.governance.approvedAt) &&
    Boolean(source.governance.approvedBy);
}
