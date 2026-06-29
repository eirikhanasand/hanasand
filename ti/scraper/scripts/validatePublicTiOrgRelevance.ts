import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildActorOrgRelevanceReadinessReport, type PublicTiOrgRelevanceProofLike } from "../src/product/analystHandoff.ts";

const args = Bun.argv.slice(2);
const allowBlockers = args.includes("--allow-blockers");
const checkedAtIndex = args.indexOf("--checked-at");
const staleBeforeIndex = args.indexOf("--stale-evidence-before");
const tenantIndex = args.indexOf("--tenant-id");
const organizationIndex = args.indexOf("--organization-id");
const requestedByIndex = args.indexOf("--requested-by-user-id");

const checkedAt = checkedAtIndex >= 0 ? args[checkedAtIndex + 1] : undefined;
const staleEvidenceBefore = staleBeforeIndex >= 0 ? args[staleBeforeIndex + 1] : undefined;
const tenantId = tenantIndex >= 0 ? args[tenantIndex + 1] : undefined;
const organizationId = organizationIndex >= 0 ? args[organizationIndex + 1] : undefined;
const requestedByUserId = requestedByIndex >= 0 ? args[requestedByIndex + 1] : undefined;
const valueIndexes = new Set([checkedAtIndex, staleBeforeIndex, tenantIndex, organizationIndex, requestedByIndex]
  .filter((index) => index >= 0)
  .map((index) => index + 1));
const files = args.filter((arg, index) =>
  arg !== "--allow-blockers"
  && arg !== "--json"
  && arg !== "--checked-at"
  && arg !== "--stale-evidence-before"
  && arg !== "--tenant-id"
  && arg !== "--organization-id"
  && arg !== "--requested-by-user-id"
  && !valueIndexes.has(index)
);

if (!files.length) {
  console.error("Usage: bun scripts/validatePublicTiOrgRelevance.ts [--json] [--allow-blockers] [--checked-at ISO_TIME] [--stale-evidence-before ISO_TIME] [--tenant-id TENANT] [--organization-id ORG] [--requested-by-user-id USER] public-ti-result.json [...public-ti-result.json]");
  process.exit(1);
}

const report = buildActorOrgRelevanceReadinessReport({
  checkedAt,
  staleEvidenceBefore,
  results: files.map((file) => {
    const path = resolve(file);
    try {
      const payload = JSON.parse(readFileSync(path, "utf8"));
      return {
        file: path,
        tenantId: payload.tenantId || tenantId,
        organizationId: payload.organizationId || organizationId,
        requestedByUserId: payload.requestedByUserId || requestedByUserId,
        orgRelevance: extractOrgRelevance(payload)
      };
    } catch (error) {
      return { file: path, tenantId, organizationId, requestedByUserId, error };
    }
  })
});

console.log(JSON.stringify(report, null, 2));

if (!allowBlockers && !report.ok) process.exit(1);

function extractOrgRelevance(payload: any): PublicTiOrgRelevanceProofLike | undefined {
  return payload.orgRelevance
    || payload.actionability?.orgRelevance
    || payload.result?.actionability?.orgRelevance
    || payload.payloads?.analystHandoffBundle?.body?.orgRelevance
    || payload.body?.orgRelevance;
}
