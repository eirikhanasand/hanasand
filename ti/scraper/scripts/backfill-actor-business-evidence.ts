import { actorBusinessEntitiesFromRetainedCapture, actorBusinessLineageCounts } from "../src/pipeline/actorBusinessBackfill.ts";
import { PostgresScraperStore } from "../src/storage/postgresScraperStore.ts";

const apply = process.argv.includes("--apply");
const store = await PostgresScraperStore.create();

try {
  const captures = store.listCaptures().filter((capture: any) => capture.metadata?.extractionProfile === "ransomware_group_metadata");
  const plans = captures.map((capture: any) => ({ capture, entities: actorBusinessEntitiesFromRetainedCapture(capture) })).filter(plan => plan.entities.length);
  const before = actorBusinessLineageCounts(store, new Set(captures.map((capture: any) => capture.id)));

  if (apply) {
    await store.batch(() => {
      for (const plan of plans) store.savePipelineResult({ capture: plan.capture, entities: plan.entities, indicators: [] });
    });
  }

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry_run", scannedCaptures: captures.length, eligibleCaptures: plans.length, extractedEntities: plans.reduce((count, plan) => count + plan.entities.length, 0), before, after: actorBusinessLineageCounts(store, new Set(captures.map((capture: any) => capture.id))) }));
} finally {
  await store.close();
}
