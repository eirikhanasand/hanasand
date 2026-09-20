import { PostgresScraperStore } from '../storage/postgresScraperStore.ts';
import { buildTimelinessWorkbench } from '../pipeline/timelinessGroundTruth.ts';
import { prepareDeliveryResponse } from '../api/deliveryWorkbenchResponse.ts';

// Aggregation and serialization stay off the HTTP server's event loop.
const storeReady = PostgresScraperStore.create({ readOnly: true, hydrate: false, deferHighVolumeHydration: true, deferStartupChecks: true });
self.onmessage = async (event: MessageEvent) => {
  const { id, tenantId } = event.data;
  try {
    const store = await storeReady;
    const { records, context } = await store.queryDeliveryWorkbench(tenantId);
    const snapshot = buildTimelinessWorkbench(records, context);
    const prepared = prepareDeliveryResponse(snapshot);
    self.postMessage({ id, snapshot, prepared });
  } catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Delivery aggregation failed' }); }
};
