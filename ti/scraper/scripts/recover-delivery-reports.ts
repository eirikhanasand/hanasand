import { PostgresScraperStore } from '../src/storage/postgresScraperStore.ts';
import { startDeliveryReportRecovery } from '../src/ops/deliveryReportRecovery.ts';

const batches = Number(process.argv[2] ?? 1);
if (!Number.isSafeInteger(batches) || batches < 1 || batches > 400) throw new Error('Specify 1–400 recovery batches.');

// Recovery uses persisted claims and needs no collector history in memory.
const store = await PostgresScraperStore.create({ hydrate: false, deferStartupChecks: true, runMaintenanceMigrations: false });
const totals: Record<string, number> = {};
let claimed = 0;
let stopping = false;
const worker = startDeliveryReportRecovery({ store: {
  claimDeliveryRecovery: async (limit: number) => {
    const items = await store.claimDeliveryRecovery(limit);
    claimed = items.length;
    return items;
  },
  finishDeliveryRecovery: async (id: string, outcome: any, reference?: any) => {
    await store.finishDeliveryRecovery(id, outcome, reference);
    totals[outcome.status] = (totals[outcome.status] ?? 0) + 1;
    console.log(JSON.stringify({ id, ...outcome }));
  },
} });
process.once('SIGTERM', () => { stopping = true; void worker.stop(); });
process.once('SIGINT', () => { stopping = true; void worker.stop(); });
try {
  for (let batch = 0; batch < batches && !stopping; batch++) {
    await worker.run();
    if (!claimed) break;
  }
} finally {
  await worker.stop();
  await store.close();
  console.log(JSON.stringify({ totals }));
}
