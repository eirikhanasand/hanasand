import { readFileSync } from "node:fs";
import { ANALYST_HANDOFF_SCHEMA_VERSION, type AnalystHandoffEnvelope, type AnalystHandoffKind } from "../src/product/analystHandoff.ts";
import {
  ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
  summarizeAnalystHandoffConsumerBundle
} from "../src/product/analystHandoffConsumer.ts";

const file = Bun.argv[2];

if (!file) {
  console.error("Usage: bun scripts/printAnalystHandoff.ts /path/to/handoff.json");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));

if ((payload.bundle || payload).schemaVersion === ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION) {
  console.log(JSON.stringify(summarizeAnalystHandoffConsumerBundle(payload.bundle || payload), null, 2));
  process.exit(0);
}

const handoff = (payload.handoff || payload) as Partial<AnalystHandoffEnvelope<AnalystHandoffKind, unknown>>;
const blockers: string[] = [];

if (handoff.schemaVersion !== ANALYST_HANDOFF_SCHEMA_VERSION) blockers.push(`unsupported schema: ${String(handoff.schemaVersion)}`);
if (!handoff.kind) blockers.push("missing handoff kind");
if (!handoff.handoffId) blockers.push("missing handoff id");
if (!handoff.identity?.tenantId) blockers.push("missing tenant id");
if (!handoff.identity?.organizationId) blockers.push("missing organization id");
if (!handoff.payload) blockers.push("missing payload");

const summary = {
  ok: blockers.length === 0,
  blockers,
  handoffId: handoff.handoffId,
  kind: handoff.kind,
  source: handoff.source,
  parentHandoffId: handoff.parentHandoffId,
  identity: handoff.identity,
  request: typeof handoff.payload === "object" && handoff.payload && "method" in handoff.payload
    ? {
        method: (handoff.payload as any).method,
        path: (handoff.payload as any).path,
        bodyKeys: Object.keys((handoff.payload as any).body || {})
      }
    : undefined
};

console.log(JSON.stringify(summary, null, 2));
