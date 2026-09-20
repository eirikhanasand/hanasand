import type { TimelinessWorkbenchDto } from '../pipeline/timelinessGroundTruth.ts';

const prepared = new WeakMap<object, { prefix: string; rows: string[]; search: string[] }>();
export function prepareDeliveryResponse(snapshot: TimelinessWorkbenchDto, encoded?: { prefix: string; rows: string[]; search: string[] }) {
  if (encoded) prepared.set(snapshot, encoded);
  let value = prepared.get(snapshot);
  if (!value) {
    const { items, ...metadata } = snapshot;
    value = { prefix: JSON.stringify(metadata).slice(0, -1), rows: items.map(item => JSON.stringify(item)),
      search: items.map(item => JSON.stringify([item.actorName,item.title,item.sourceName,item.sourceId,item.incidentId,item.captureId,item.reportReferences,item.timestampAnomalies]).toLowerCase()) };
    prepared.set(snapshot, value);
  }
  return value;
}

export function deliveryResponse(snapshot: TimelinessWorkbenchDto, input: { status?: string | null; query?: string; offset: number; limit: number }) {
  const view = prepareDeliveryResponse(snapshot);
  const selected: number[] = [];
  for (let i=0;i<snapshot.items.length;i++) if ((!input.status || snapshot.items[i].status===input.status) && (!input.query || view.search[i].includes(input.query))) selected.push(i);
  const items = selected.slice(input.offset,input.offset+input.limit).map(i=>view.rows[i]).join(',');
  const page = { total:selected.length,limit:input.limit,cursor:input.offset,nextCursor:input.offset+input.limit<selected.length?String(input.offset+input.limit):null };
  return new Response(`${view.prefix},"items":[${items}],"page":${JSON.stringify(page)}}`,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
