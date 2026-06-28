import { parseTelegramTarget, validateTelegramPublicSourceCompliance } from "../adapters/telegramPublic.ts";
import { evaluateTelegramPublicCompliance } from "../policy/telegramCollectionPolicy.ts";
import { applyDwmSeedCatalog, sourceDedupeKey } from "../product/dwmSourceInventory.ts";
import { nowIso, stableId } from "../utils.ts";
import { json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import type { SourceRecord } from "../types.ts";

type DwmSourceRequestBody = {
  target?: string;
  type?: "telegram_channel" | "restricted_metadata";
  tenantId?: string;
  scope?: string;
  activate?: boolean;
  approveMetadataOnly?: boolean;
  approvedBy?: string;
  dryRun?: boolean;
  limit?: number;
  targets?: string[];
  seedPackIds?: string[];
  priority?: "critical" | "high" | "medium";
};

export async function createDwmSourceRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<DwmSourceRequestBody>(request);
  if (Array.isArray(body.seedPackIds) && body.seedPackIds.length > 0) {
    const result = applyDwmSeedCatalog({
      store: options.store,
      tenantId: body.tenantId,
      watchlist: body.scope ? body.scope.split(/[,\n]/).map((term) => term.trim()).filter(Boolean) : undefined,
      seedPackIds: body.seedPackIds,
      activate: body.activate,
      approveMetadataOnly: body.approveMetadataOnly,
      approvedBy: body.approvedBy,
      dryRun: body.dryRun,
      limit: body.limit
    });
    return json({
      request: {
        id: stableId("dwm_source_pack_request", `${result.summary.requestedPackIds.join(",")}:${result.generatedAt}`),
        type: "seed_catalog",
        approvalState: body.dryRun ? "dry_run" : "queued",
        nextAction: body.activate
          ? "Canary-ready public sources were queued; restricted metadata candidates still require analyst approval."
          : "Review generated source candidates, then activate selected public channels into canary polling."
      },
      ...result
    }, body.dryRun ? 200 : 201);
  }

  if (Array.isArray(body.targets) && body.targets.length > 0) {
    const created: SourceRecord[] = [];
    const rejected: Array<{ target: string; code: string; message: string }> = [];
    const duplicates: Array<{ target: string; duplicateOf: string }> = [];
    for (const target of body.targets.slice(0, Math.max(1, Math.min(body.limit ?? 100, 100)))) {
      const result = createTelegramSourceFromTarget(target, body, options);
      if (result.kind === "error") rejected.push({ target, code: result.code, message: result.message });
      if (result.kind === "duplicate") duplicates.push({ target, duplicateOf: result.duplicateOf });
      if (result.kind === "created") created.push(result.source);
    }
    return json({
      request: {
        id: stableId("dwm_bulk_source_request", `${created.map((source) => source.id).join(",")}:${rejected.length}:${duplicates.length}`),
        type: "bulk_targets",
        approvalState: "queued",
        nextAction: "Review rejected and duplicate targets; created public Telegram sources are bounded to safe preview collection."
      },
      createdSources: created,
      rejected,
      duplicates,
      summary: { createdCount: created.length, rejectedCount: rejected.length, duplicateCount: duplicates.length }
    }, created.length ? 201 : 400);
  }

  if (body.type === "restricted_metadata") return json({
    request: {
      id: stableId("dwm_source_request", `${body.target ?? "restricted"}:${nowIso()}`),
      target: body.target ?? "",
      type: "restricted_metadata",
      approvalState: "queued",
      nextAction: "Human approval required. Restricted sources stay metadata-only and block downloads, login, interaction, and payload paths."
    }
  }, 202);

  const target = String(body.target ?? "").trim();
  const created = createTelegramSourceFromTarget(target, body, options);
  if (created.kind === "error") return json({ error: { code: created.code, message: created.message } }, 400);
  if (created.kind === "duplicate") return json({
    request: {
      id: stableId("dwm_source_request", `${target}:duplicate`),
      target,
      type: "telegram_channel",
      approvalState: "duplicate",
      nextAction: "Use the existing source or update its scope rather than adding a duplicate."
    },
    duplicateOf: created.duplicateOf
  }, 200);
  const saved = created.source;
  return json({
    source: saved,
    request: {
      id: stableId("dwm_source_request", `${saved.id}:${saved.url}`),
      target: saved.url,
      type: "telegram_channel",
      approvalState: saved.status === "active" ? "approved_public" : "queued",
      nextAction: saved.status === "active"
        ? "Source is active for bounded public preview polling on the next canary cycle."
        : "Review the public channel, then activate bounded polling."
    }
  }, 201);
}

function createTelegramSourceFromTarget(target: string, body: DwmSourceRequestBody, options: ApiServerOptions):
  | { kind: "created"; source: SourceRecord }
  | { kind: "duplicate"; duplicateOf: string }
  | { kind: "error"; code: string; message: string } {
  if (/t\.me\/(?:\+|joinchat|c\/)|telegram\.me\/(?:\+|joinchat|c\/)|^tg:\/\/join/i.test(target)) {
    return { kind: "error", code: "telegram_policy_blocked", message: "Private invite, joinchat, and private-channel Telegram URLs are blocked." };
  }
  const channel = parseTelegramTarget(target).channel;
  if (!channel) return { kind: "error", code: "invalid_target", message: "A public t.me channel URL or @handle is required." };

  const source = telegramSourceFromRequest({ target, channel, body });
  const duplicate = options.store.listSources().find((existing) => sourceDedupeKey(existing) === sourceDedupeKey(source));
  if (duplicate) return { kind: "duplicate", duplicateOf: String(duplicate.id) };
  const policy = evaluateTelegramPublicCompliance(source);
  const compliance = validateTelegramPublicSourceCompliance(source);
  if (!policy.allowed) return { kind: "error", code: "telegram_policy_blocked", message: policy.reason };
  if (!compliance.allowed) return { kind: "error", code: "telegram_compliance_blocked", message: compliance.reason ?? "Telegram public source compliance check failed." };

  const saved = options.store.saveSource(source);
  return { kind: "created", source: saved };
}

function telegramSourceFromRequest(input: { target: string; channel: string; body: DwmSourceRequestBody }): SourceRecord {
  const generatedAt = nowIso();
  const normalizedUrl = `https://t.me/${input.channel}`;
  return {
    id: stableId("src_dwm_tg", normalizedUrl),
    name: `DWM Telegram ${input.channel}`,
    type: "telegram_public",
    url: normalizedUrl,
    accessMethod: "public_http",
    status: input.body.activate === false ? "candidate" : "active",
    risk: input.body.priority === "critical" ? "high" : "medium",
    trustScore: input.body.priority === "critical" ? 0.72 : 0.62,
    crawlFrequencySeconds: input.body.priority === "critical" ? 300 : 900,
    legalNotes: "Public Telegram preview collection only. No private invite access, auto-join, session credentials, or media downloads.",
    language: "en",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    metadata: {
      tenantId: input.body.tenantId,
      dwmSourceRequest: true,
      canaryPortfolio: true,
      sourceFamily: "telegram_public",
      scope: input.body.scope,
      maxItemsPerFetch: 40,
      mediaPolicy: "metadata_only_no_download",
      collectionBoundary: {
        publicOnly: true,
        noPrivateAccess: true,
        noAutoJoin: true,
        noCredentialCollection: true,
        noMediaDownload: true
      }
    }
  } as SourceRecord;
}
