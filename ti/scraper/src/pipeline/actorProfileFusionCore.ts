// @ts-nocheck
import { clampScore } from "../utils.ts";
import { buildLiveTiSearchSummary } from "./intelligenceProfiles.ts";
import type { FuseActorProfileInput, FusedActorProfile } from "./actorProfileFusionTypes.ts";
import { deltaSummary, latest, rowsFor, uncertainty, uniq } from "./actorProfileFusionUtils.ts";

export function fuseActorProfile(input: FuseActorProfileInput): FusedActorProfile {
  const now = input.now ?? new Date().toISOString();
  const rows = rowsFor(input);
  const summary = rows.length ? buildLiveTiSearchSummary(input.query, input.evidence) : undefined;
  const actor = input.baseline?.actor ?? summary?.query ?? input.query;
  const aliases = uniq([...(input.baseline?.aliases ?? []), ...rows.flatMap((r) => r.result.entities.filter((e) => e.type === "actor").flatMap((e) => [e.value, ...(e.aliases ?? [])]))]);
  const targets = {
    victims: uniq([...(input.baseline?.targets?.victims ?? []), ...rows.flatMap((r) => r.dto.targets?.victims ?? [])]),
    sectors: uniq([...(input.baseline?.targets?.sectors ?? []), ...rows.flatMap((r) => r.dto.targets?.sectors ?? [])]),
    regions: uniq([...(input.baseline?.targets?.regions ?? []), ...rows.flatMap((r) => r.dto.targets?.regions ?? [])])
  };
  const profile = {
    actor, aliases, vendorNames: aliases.filter((a) => a.toLowerCase() !== actor.toLowerCase()), targets,
    ttps: uniq([...(input.baseline?.ttps ?? []), ...rows.flatMap((r) => r.dto.ttps ?? [])]),
    confidence: clampScore(summary?.confidence ?? input.baseline?.confidence ?? 0),
    updatedAt: latest([summary?.lastUpdated, input.baseline?.updatedAt, now]) ?? now,
    evidenceIds: uniq([...(input.baseline?.evidenceIds ?? []), ...input.evidence.map((e) => e.id)]),
    sourceUncertainty: rows.map((r) => uncertainty(r)),
    needsAnalystReview: Boolean(summary?.needsAnalystReview || rows.some((r) => r.dto.caveats?.some((c) => c.severity !== "info")))
  };
  return { profile, deltas: deltaSummary(input.baseline, profile, input.evidence) };
}
