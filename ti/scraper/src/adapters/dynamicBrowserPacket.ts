import type { DynamicBrowserCutoverInput, DynamicBrowserCutoverPacketDto } from "./dynamicBrowserTypes.ts";
import { FORBIDDEN, STABLE } from "./dynamicBrowserConstants.ts";
import { buildGates } from "./dynamicBrowserGates.ts";
import { fixtureResult } from "./dynamicBrowserFixture.ts";
import { readiness } from "./dynamicBrowserReadiness.ts";
import { budget, count, hash, hasIsolation, isolationClasses, numbers, uniq } from "./dynamicBrowserUtils.ts";

export function buildDynamicBrowserCutoverPacket(input: DynamicBrowserCutoverInput): DynamicBrowserCutoverPacketDto {
  const fixtures = input.fixtures.map((fixture: any) => fixtureResult(input, fixture));
  const gates = buildGates(input, fixtures);
  const decision = input.policy.killSwitchActive ? "kill_switch" : gates.some((g: any) => g.status === "hold") ? "hold" : gates.some((g: any) => g.status === "watch") ? "watch" : "canary_ready";
  const warnings = uniq(fixtures.map((fixture: any) => fixture.handoffs.agent09ApiWarningField).filter((field: string) => field !== "none"));
  const resourceBudget = budget(input.pool);
  return {
    schemaVersion: "ti.dynamic_browser_cutover.v1", generatedAt: input.generatedAt, decision,
    browserWorkersEnabled: false, canaryOnly: true, requiresExplicitApproval: true,
    workerPool: { name: "dynamic_public_browser", ...numbers(input.pool) },
    networkIsolation: { publicOnly: true, hostAllowlistHashes: uniq(input.policy.hostAllowlist.map((host: string) => `hosthash:${hash(host)}`)), blockPrivateNetworks: true, blockCredentials: true, blockCaptchaSolving: true, blockDownloads: true, blockOnionLinks: true },
    evidenceBoundary: { screenshotStorage: "hash_only", objectRefs: "hash_only", rawHtmlExposed: false, rawTextExposed: false, rawUrlExposed: false },
    isolationCanary: { featureFlag: "disabled_by_default", fixtureReplayOnly: true, browserPoolSharedWithStaticCollectors: false, privateNetworkTargetsBlocked: true, credentialPromptsBlocked: true, captchaChallengesBlocked: true, downloadsBlocked: true, onionRedirectsBlocked: true, thirdPartyRequestLeaksBlocked: true, storagePolicy: "hashes_only_no_cookie_jar_no_local_storage" },
    resourceBudget,
    storageIsolation: { cookieJarPersisted: false, localStoragePersisted: false, sessionStoragePersisted: false, cachePersisted: false, downloadsPersisted: false, screenshotBytesPersisted: false, rawHtmlPersisted: false, objectRefsExposed: false, retainedFields: ["sourceId", "fixtureId", "taskId", "requestedUrlHash", "finalUrlHash", "canonicalUrlHash", "contentHash", "screenshotHash", "objectRefHash", "fetchedAt", "parserConfidence", "extractionWarnings"] },
    killSwitch: { active: input.policy.killSwitchActive, triggerReasons: gates.filter((gate: any) => gate.status === "hold").map((gate: any) => gate.name), rollbackAction: input.policy.killSwitchActive ? "pause_canary_pool" : "keep_disabled" },
    fixtures, gates,
    summary: { totalFixtures: fixtures.length, pass: count(fixtures, "pass"), watch: count(fixtures, "watch"), hold: count(fixtures, "hold"), sourceIds: uniq(fixtures.map((fixture: any) => fixture.sourceId)), warningCodes: warnings, objectRefHashes: uniq(fixtures.flatMap((fixture: any) => fixture.objectRefHash ? [fixture.objectRefHash] : [])), screenshotHashes: uniq(fixtures.flatMap((fixture: any) => fixture.screenshotHash ? [fixture.screenshotHash] : [])), isolationHoldCount: fixtures.filter((fixture: any) => hasIsolation(fixture.checks)).length, blockedTargetClasses: uniq(fixtures.flatMap((fixture: any) => isolationClasses(fixture.checks))) },
    agentHandoffs: { agent01SourceActivation: uniq(fixtures.map((f: any) => f.handoffs.agent01SourceActivation)), agent02SchedulerBudgets: uniq(fixtures.map((f: any) => f.handoffs.agent02SchedulerBudget)), agent04PublicSourceExpansion: uniq(fixtures.map((f: any) => f.handoffs.agent04PublicSourceExpansion)), agent06EvidenceChain: uniq(fixtures.map((f: any) => f.handoffs.agent06EvidenceChain)), agent07QualityGates: uniq(fixtures.map((f: any) => f.handoffs.agent07QualityGate)), agent09ApiWarningFields: warnings, agent10ResourceGates: uniq(fixtures.map((f: any) => f.handoffs.agent10ResourceGate)) },
    promotionReadiness: readiness(decision, gates, fixtures),
    routeContract: { safeForPublicApi: true, stableFields: STABLE, forbiddenFields: FORBIDDEN },
    safety: { publicOnly: true, dryRunOnly: true, noAuthBypass: true, noCaptchaSolving: true, noPrivateCommunities: true, noExploitPayloadDownload: true, noRestrictedRawMaterial: true, unsafeUrlExposed: false }
  };
}
