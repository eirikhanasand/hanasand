const ORGANIZATION_ID = "org_hanasand_operational_canary";
const OWNER_ID = "ops-workflow-canary";
const DESTINATION_ID = "webhook_hanasand_operational_canary";
const WATCHLIST_ID = "watchlist_hanasand_operational_canary";
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function runOperationalWorkflowCanary(input: {
  base?: string;
  sinkUrl?: string;
  fetcher?: Fetcher;
  serviceToken?: string;
} = {}) {
  const base = input.base ?? Bun.env.TI_SCRAPER_API_URL ?? "http://127.0.0.1:8097";
  const sinkUrl = input.sinkUrl ?? Bun.env.TI_WORKFLOW_CANARY_SINK_URL ?? "https://hanasand.com/api/dwm/webhook-sink";
  const fetcher = input.fetcher ?? fetch;
  const serviceToken = input.serviceToken ?? Bun.env.TI_SCRAPER_SERVICE_TOKEN;
  if (!serviceToken) throw new Error("TI_SCRAPER_SERVICE_TOKEN is required");
  const headers = { "content-type": "application/json", "x-actor-id": OWNER_ID, "x-hanasand-service-token": serviceToken };

  await post(fetcher, `${base}/v1/organizations`, {
    id: ORGANIZATION_ID,
    name: "Hanasand operational workflow canary",
    kind: "operational_canary",
    ownerEmail: "workflow-canary@hanasand.invalid",
    ownerUserId: OWNER_ID,
    createdBy: OWNER_ID
  }, headers);
  await post(fetcher, `${base}/v1/organizations/${ORGANIZATION_ID}/webhooks`, {
    id: DESTINATION_ID,
    name: "Hanasand webhook acceptance canary",
    kind: "generic",
    url: sinkUrl
  }, headers);
  const transport = await post(fetcher, `${base}/v1/organizations/${ORGANIZATION_ID}/webhooks/test`, {
    webhookDestinationId: DESTINATION_ID,
    dryRun: false
  }, headers);
  if (!transport.ok || transport.delivery?.status !== "delivered") throw new Error("workflow canary transport delivery failed");

  await post(fetcher, `${base}/v1/dwm/watchlists`, {
    id: WATCHLIST_ID,
    organizationId: ORGANIZATION_ID,
    name: "Operational canary: Akira",
    terms: ["Akira"],
    webhookDestinationId: DESTINATION_ID
  }, headers);
  const rebuild = await post(fetcher, `${base}/v1/dwm/alerts/rebuild`, { organizationId: ORGANIZATION_ID }, headers);
  if (Number(rebuild.savedAlertCount) < 1) throw new Error("workflow canary found no evidence-backed watchlist alert");

  const delivery = await post(fetcher, `${base}/v1/dwm/webhooks/deliver`, { organizationId: ORGANIZATION_ID }, headers);
  const deliveredNow = (delivery.deliveries ?? []).filter((row: any) => row.status === "delivered").length;
  const history = await get(fetcher, `${base}/v1/dwm/webhooks/deliveries?organizationId=${ORGANIZATION_ID}`, headers);
  const historicalDelivered = (history.deliveries ?? []).filter((row: any) => row.alertId !== "organization_webhook_test" && row.status === "delivered").length;
  if (deliveredNow + historicalDelivered < 1) throw new Error("workflow canary has no delivered evidence alert");

  return {
    schemaVersion: "ti.operational_workflow_canary.v1",
    checkedAt: new Date().toISOString(),
    organizationId: ORGANIZATION_ID,
    organizationKind: "operational_canary",
    transportStatus: "delivered",
    evidenceAlertCount: Number(rebuild.savedAlertCount),
    deliveredNow,
    historicalDelivered,
    ok: true
  };
}

async function post(fetcher: Fetcher, url: string, body: unknown, headers: Record<string, string>) {
  const response = await fetcher(url, { method: "POST", headers, body: JSON.stringify(body) });
  return responseBody(response, url);
}

async function get(fetcher: Fetcher, url: string, headers: Record<string, string>) {
  return responseBody(await fetcher(url, { headers }), url);
}

async function responseBody(response: Response, url: string) {
  const body = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(`${new URL(url).pathname} failed with HTTP ${response.status}: ${body?.error?.code ?? body?.error ?? "unknown_error"}`);
  return body;
}

if (import.meta.main) console.log(JSON.stringify(await runOperationalWorkflowCanary()));
