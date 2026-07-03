import assert from "node:assert/strict";

type JsonRecord = Record<string, any>;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log([
    "Usage:",
    "  DWM_LIVE_API_BASE_URL=https://scraper.example.com \\",
    "  DWM_LIVE_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... \\",
    "  bun run smoke:live-alert-discord",
    "",
    "Optional:",
    "  DWM_LIVE_PROBE_TERM=acme.com",
    "  DWM_LIVE_WEBHOOK_DESTINATION_ID=webhook_destination_...",
    "  DWM_LIVE_AUTHORIZATION='Bearer ...'",
    "  DWM_LIVE_ORGANIZATION_ID=org_...",
    "  DWM_LIVE_ACTOR_ID=user_...",
    "  DWM_LIVE_OWNER_EMAIL=analyst@example.com",
    "  DWM_LIVE_CREATE_ORGANIZATION=false"
  ].join("\n"));
  process.exit(0);
}

const baseUrl = requiredEnv("DWM_LIVE_API_BASE_URL").replace(/\/+$/, "");
let term = env("DWM_LIVE_PROBE_TERM");
const webhookUrl = env("DWM_LIVE_DISCORD_WEBHOOK_URL");
const webhookDestinationId = env("DWM_LIVE_WEBHOOK_DESTINATION_ID");
const organizationId = env("DWM_LIVE_ORGANIZATION_ID") || `org_live_alert_probe_${Date.now()}`;
const ownerEmail = env("DWM_LIVE_OWNER_EMAIL") || "live-alert-probe@hanasand.example";
const actorId = env("DWM_LIVE_ACTOR_ID") || "live-alert-probe";
const authHeader = env("DWM_LIVE_AUTHORIZATION");
const createOrganization = env("DWM_LIVE_CREATE_ORGANIZATION") !== "false";

assert.ok(webhookUrl || webhookDestinationId, "Provide DWM_LIVE_DISCORD_WEBHOOK_URL or DWM_LIVE_WEBHOOK_DESTINATION_ID.");
if (webhookUrl) assert.match(webhookUrl, /^https:\/\/discord(?:app)?\.com\/api\/webhooks\//, "DWM_LIVE_DISCORD_WEBHOOK_URL must be a Discord webhook URL.");
if (term) assert.ok(term.length >= 3, "DWM_LIVE_PROBE_TERM must be at least 3 characters.");

const startedAt = new Date().toISOString();

if (createOrganization) {
  const org = await postJson("/v1/organizations", {
    id: organizationId,
    name: `Live alert probe ${term ?? "auto term"}`,
    slug: organizationId.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 60),
    ownerEmail,
    ownerUserId: actorId
  });
  assert.ok([200, 201].includes(org.response.status), `organization create/upsert failed: ${org.response.status} ${JSON.stringify(org.body)}`);
}

let discoveredTerm: JsonRecord | undefined;
if (!term) {
  const readiness = await getJson(`/v1/dwm/alerts/generation-readiness?organizationId=${encodeURIComponent(organizationId)}`);
  assert.equal(readiness.response.status, 200, `alert generation readiness failed: ${readiness.response.status} ${JSON.stringify(readiness.body)}`);
  discoveredTerm = firstWatchableTerm(readiness.body);
  term = discoveredTerm?.term;
  assert.ok(term && term.length >= 3, `no source-matched watchlist term was available from recent captures; readiness=${JSON.stringify(readiness.body)}`);
}

const watchlist = await postJson("/v1/dwm/watchlists", {
  organizationId,
  name: `Live probe - ${term}`,
  terms: [term],
  webhookUrl,
  webhookDestinationId,
  reason: "live_alert_probe"
});
assert.equal(watchlist.response.status, 201, `watchlist create failed: ${watchlist.response.status} ${JSON.stringify(watchlist.body)}`);

const rebuild = watchlist.body.alertRebuild ?? {};
assert.ok(Number(rebuild.savedAlertCount ?? 0) > 0, `no alerts were generated for term "${term}"; alertRebuild=${JSON.stringify(rebuild)}`);
assert.ok(Array.isArray(rebuild.alertIds) && rebuild.alertIds.length > 0, "alert rebuild did not return alert ids.");
assert.ok(Array.isArray(rebuild.sourceFamilies) && rebuild.sourceFamilies.length > 0, "alert rebuild did not return source families.");
assert.ok(Array.isArray(rebuild.matchedTerms) && rebuild.matchedTerms.includes(term), "alert rebuild did not report the monitored term.");

const alerts = await getJson(`/v1/dwm/alerts?organizationId=${encodeURIComponent(organizationId)}`);
assert.equal(alerts.response.status, 200, `alert list failed: ${alerts.response.status} ${JSON.stringify(alerts.body)}`);
const postWatchlistAlertCount = Array.isArray(alerts.body.alerts) ? alerts.body.alerts.length : 0;
const alert = (alerts.body.alerts ?? []).find((row: JsonRecord) => (rebuild.alertIds ?? []).includes(row.id)) ?? alerts.body.alerts?.[0];
assert.ok(alert, "created alert was not visible through /v1/dwm/alerts.");
assert.equal(alert.organizationId, organizationId);
assert.ok(String(alert.sourceFamily ?? ""), "alert is missing sourceFamily.");
assert.ok(String(alert.alertDetailPath ?? "").includes("/v1/dwm/alerts/"), "alert is missing alertDetailPath.");
assert.ok(Number(alert.evidenceCount ?? alert.evidenceSummary?.evidenceCount ?? 0) > 0, "alert is missing evidence.");
assert.ok(String(alert.recommendedRoute ?? alert.routingContext?.queue ?? ""), "alert is missing recommended route.");

const detail = await getJson(String(alert.alertDetailPath));
assert.equal(detail.response.status, 200, `alert detail failed: ${detail.response.status} ${JSON.stringify(detail.body)}`);
assert.equal(detail.body.schemaVersion, "dwm.alert_detail.v1");
assert.ok(detail.body.evidenceReplay?.length > 0, "alert detail has no evidence replay.");
assert.ok(detail.body.evidenceReplay?.[0]?.provenance?.captureId, "alert detail evidence is missing capture provenance.");

const delivery = await postJson("/v1/dwm/webhooks/deliver", { organizationId, alertId: alert.id, webhookDestinationId });
assert.equal(delivery.response.status, 200, `webhook delivery failed: ${delivery.response.status} ${JSON.stringify(delivery.body)}`);
const delivered = (delivery.body.deliveries ?? []).filter((row: JsonRecord) => row.status === "delivered");
assert.ok(delivered.length > 0 || Number(delivery.body.deliveredCount ?? 0) > 0, `Discord delivery was not accepted: ${JSON.stringify(delivery.body)}`);
const deliveredRoute = delivered[0] ?? delivery.body.deliveries?.[0];
assert.equal(deliveredRoute?.organizationId, organizationId, "Discord delivery did not retain organization scope.");
assert.equal(deliveredRoute?.tenantId, organizationId, "Discord delivery did not retain tenant scope.");
assert.ok(deliveredRoute?.watchlistId, "Discord delivery did not retain watchlist route.");
assert.equal(deliveredRoute?.deliveryKind, "discord", "Delivery route was not classified as Discord.");
assert.ok(deliveredRoute?.endpointHash, "Discord delivery did not persist endpoint hash.");

console.log(JSON.stringify({
  event: "live_alert_discord_smoke",
  ok: true,
  startedAt,
  finishedAt: new Date().toISOString(),
  baseUrl,
  organizationId,
  term,
  termSource: discoveredTerm ? "alert_generation_readiness" : "env",
  discoveredTerm,
  webhookDestinationId: webhookDestinationId ?? null,
  webhookUrlProvided: Boolean(webhookUrl),
  savedAlertCount: Number(rebuild.savedAlertCount ?? 0),
  postWatchlistAlertCount,
  alertCountDeltaFromRebuild: Number(rebuild.savedAlertCount ?? 0),
  alertIds: rebuild.alertIds,
  sourceFamilies: rebuild.sourceFamilies,
  matchedTerms: rebuild.matchedTerms,
  deliveredCount: Number(delivery.body.deliveredCount ?? delivered.length),
  deliveredRoute: deliveredRoute ? {
    organizationId: deliveredRoute.organizationId,
    tenantId: deliveredRoute.tenantId,
    watchlistId: deliveredRoute.watchlistId,
    webhookDestinationId: deliveredRoute.webhookDestinationId,
    deliveryKind: deliveredRoute.deliveryKind,
    endpointHash: deliveredRoute.endpointHash,
    status: deliveredRoute.status
  } : null,
  alert: {
    id: alert.id,
    sourceFamily: alert.sourceFamily,
    matchedTerm: alert.matchedTerm?.value ?? alert.matchedTerm,
    recommendedRoute: alert.recommendedRoute ?? alert.routingContext?.queue,
    evidenceCount: alert.evidenceCount ?? alert.evidenceSummary?.evidenceCount,
    alertDetailPath: alert.alertDetailPath
  }
}, null, 2));

async function getJson(pathOrUrl: string) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
  const response = await fetch(url, { headers: headers() });
  return { response, body: await jsonBody(response) };
}

async function postJson(path: string, body: JsonRecord) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      ...headers(),
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return { response, body: await jsonBody(response) };
}

async function jsonBody(response: Response): Promise<JsonRecord> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return { raw: text };
  }
}

function headers() {
  return Object.fromEntries(Object.entries({
    authorization: authHeader,
    "x-actor-id": actorId,
    "x-user-email": ownerEmail,
    "x-organization-id": organizationId,
    "x-tenant-id": organizationId
  }).filter(([, value]) => Boolean(value))) as Record<string, string>;
}

function env(name: string) {
  return process.env[name]?.trim();
}

function requiredEnv(name: string) {
  const value = env(name);
  if (!value) {
    throw new Error(`Missing ${name}. Required live probe vars: DWM_LIVE_API_BASE_URL plus DWM_LIVE_DISCORD_WEBHOOK_URL or DWM_LIVE_WEBHOOK_DESTINATION_ID. Optional: DWM_LIVE_PROBE_TERM, DWM_LIVE_AUTHORIZATION, DWM_LIVE_ORGANIZATION_ID, DWM_LIVE_ACTOR_ID, DWM_LIVE_OWNER_EMAIL, DWM_LIVE_CREATE_ORGANIZATION=false.`);
  }
  return value;
}

function firstWatchableTerm(body: JsonRecord): JsonRecord | undefined {
  const candidates = [
    ...(body.readiness?.plan?.candidates ?? []),
    ...(body.readiness?.zeroAlertProof?.watchlistTerms ?? [])
  ];
  for (const candidate of candidates) {
    const term = String(candidate.term ?? candidate.value ?? candidate.normalizedTerm ?? candidate.matchedTerm?.value ?? "").trim();
    if (term.length < 3) continue;
    const captureCount = Number(candidate.captureRefCount ?? candidate.captureRefs?.length ?? candidate.evidenceCount ?? 0);
    if (captureCount <= 0 && candidate.hasMatchingCaptures === false) continue;
    return {
      term,
      sourceFamily: candidate.sourceFamily,
      captureRefCount: captureCount,
      candidateId: candidate.id ?? candidate.candidateId,
      watchlistId: candidate.watchlistId
    };
  }
  return undefined;
}
