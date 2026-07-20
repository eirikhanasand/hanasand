import { expect, test } from "bun:test";
import { runOperationalWorkflowCanary } from "../../scripts/run-operational-workflow-canary.ts";

const ORGANIZATION_ID = "org_hanasand_operational_canary";

test("runs the operational workflow canary through transport, watchlist, alert, and delivery", async () => {
  const paths: string[] = [];
  const result = await runOperationalWorkflowCanary({
    base: "http://canary.test",
    sinkUrl: "https://hanasand.com/api/dwm/webhook-sink",
    fetcher: async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path.endsWith("/webhooks/test")) return Response.json({ ok: true, delivery: { status: "delivered" } });
      if (path.endsWith("/alerts/rebuild")) return Response.json({ savedAlertCount: 1 });
      if (path.endsWith("/webhooks/deliver")) return Response.json({ deliveries: [{ status: "delivered" }] });
      if (path.endsWith("/webhooks/deliveries")) return Response.json({ deliveries: [] });
      return Response.json({ ok: true }, { status: 201 });
    }
  });

  expect(result).toMatchObject({ ok: true, organizationKind: "operational_canary", transportStatus: "delivered", evidenceAlertCount: 1, deliveredNow: 1 });
  expect(paths).toEqual([
    "/v1/organizations",
    `/v1/organizations/${ORGANIZATION_ID}/webhooks`,
    `/v1/organizations/${ORGANIZATION_ID}/webhooks/test`,
    "/v1/dwm/watchlists",
    "/v1/dwm/alerts/rebuild",
    "/v1/dwm/webhooks/deliver",
    "/v1/dwm/webhooks/deliveries"
  ]);
});
