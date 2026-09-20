import { expect, test } from 'bun:test';
import { recoverDeliveryReport, publicationEvidence, verifiedModelEvidence, startDeliveryReportRecovery } from '../ops/deliveryReportRecovery.ts';
import { PostgresScraperStore } from '../storage/postgresScraperStore.ts';

const item = { timeline: { id:'i',incidentId:'i',captureId:'c',sourceId:'s',collectedAt:'2026-09-01T10:00:00Z' }, capture:{url:'https://example.org/incident'},source:{status:'active',name:'Publisher'} };
test('retired sources retain usable report evidence and its original reporter role', async () => {
  const reference = { role:'actor', timestamp:'2026-08-01T10:00:00Z', referenceUrl:'https://example.org/original', evidencePath:'feed.entry.pubDate', extractionMethod:'source_field' };
  const archived = { ...item, source:{...item.source,status:'retired'}, capture:{...item.capture,metadata:{reportTimestamps:[reference]}} };
  expect(await recoverDeliveryReport(archived,{fetchPublic:()=>{throw Error('retired source must not be fetched')}})).toMatchObject({status:'resolved',modelUsed:false,reference:{role:'actor',referenceUrl:reference.referenceUrl,evidencePath:reference.evidencePath}});
  expect(await recoverDeliveryReport({...archived,capture:{...item.capture,metadata:{reportTimestamps:[{...reference,evidencePath:''}]}}})).toMatchObject({status:'unavailable'});
});
test('publication evidence accepts explicit dates, not updates or unzoned guesses', () => {
  expect(publicationEvidence('<meta content="2026-08-01T10:00:00Z" property="article:published_time">')?.timestamp).toBe('2026-08-01T10:00:00Z');
  expect(publicationEvidence('<script type="application/ld+json">{"datePublished":"2026-08-01T10:00:00Z"}</script>')?.timestamp).toBe('2026-08-01T10:00:00Z');
  expect(publicationEvidence('<meta property="article:modified_time" content="2026-08-01T10:00:00Z">')).toBeUndefined();
  expect(publicationEvidence('<meta property="article:published_time" content="2026-08-01">')).toBeUndefined();
  expect(verifiedModelEvidence('Published: 2026-08-01T10:00:00Z', {timestamp:'2026-08-01T10:00:00Z',quote:'Published: 2026-08-01T10:00:00Z'})).toBeDefined();
  expect(verifiedModelEvidence('No date', {timestamp:'2026-08-01T10:00:00Z',quote:'Published: 2026-08-01T10:00:00Z'})).toBeUndefined();
});
test('Ransomware.live discovery timestamps retain the displayed UTC precision', async () => {
  const html = '<span class="rl-info-label"><i class="fa-solid fa-calendar-check"></i> Discovered</span>\n<span class="rl-info-value">2026-07-27 04:20 <small class="text-muted">UTC</small></span>';
  const url = 'https://www.ransomware.live/id/example';
  expect(publicationEvidence(html, url)).toMatchObject({timestamp:'2026-07-27T04:20Z',evidencePath:'html.rl-info.Discovered',quote:html});
  expect(publicationEvidence(html, 'https://example.org/')).toBeUndefined();
  expect(publicationEvidence(html.replace('Discovered','Est. attack date'),url)).toBeUndefined();
  expect(publicationEvidence(html.replace('UTC',''),url)).toBeUndefined();
  expect(await recoverDeliveryReport({...item,capture:{url}},{fetchPublic:async()=>new Response(html),fetchModel:()=>{throw Error('must not call AI')}})).toMatchObject({status:'resolved',modelUsed:false,reference:{timestamp:'2026-07-27T04:20:00.000Z',rawTimestamp:'2026-07-27T04:20Z'}});
});
test('known source evidence avoids AI; fresh pages cannot invent an earlier first report', async () => {
  const result=await recoverDeliveryReport(item,{fetchPublic:async()=>new Response('<meta property="article:published_time" content="2026-08-01T10:00:00Z">'),fetchModel:()=>{throw Error('must not call AI')}});
  expect(result).toMatchObject({status:'resolved',modelUsed:false,reference:{role:'publisher',timestamp:'2026-08-01T10:00:00.000Z',captureId:'c',extractionMethod:'source_field'}});
  expect(result.reference?.contentSha256).toHaveLength(64);
  expect(await recoverDeliveryReport(item,{fetchPublic:async()=>new Response('<meta property="article:published_time" content="2026-10-01T10:00:00Z">')})).toMatchObject({status:'unavailable'});
});
test('AI must ground its result; failures remain retryable and private references are not fetched', async () => {
  const html='Published: 2026-08-01T10:00:00Z';
  expect(await recoverDeliveryReport(item,{fetchPublic:async()=>new Response(html),fetchModel:async()=>Response.json({message:JSON.stringify({timestamp:'2026-08-01T10:00:00Z',quote:html})})})).toMatchObject({status:'resolved',modelUsed:true});
  expect(await recoverDeliveryReport(item,{fetchPublic:async()=>new Response('no date'),fetchModel:async()=>Response.json({message:JSON.stringify({timestamp:'2026-08-01T10:00:00Z',quote:html})})})).toMatchObject({status:'unavailable',modelUsed:true});
  await expect(recoverDeliveryReport(item,{fetchPublic:async()=>new Response('',{status:503})})).rejects.toThrow('503');
  expect(await recoverDeliveryReport({...item,capture:{url:'http://127.0.0.1/'}},{fetchPublic:()=>{throw Error('must not fetch')}})).toMatchObject({status:'unavailable'});
});
test('snapshots isolate tenants, coalesce concurrent loads and retain good data during refresh', async () => {
  const store = new (PostgresScraperStore as any)({}, []);
  let calls=0, release:()=>void=()=>{};
  store.queryDeliveryWorkbench=async (tenantId?:string)=>{calls++;return {records:[{id:tenantId||'global',incidentId:'i',captureId:'c',sourceId:'s'}],context:{}}};
  await Promise.all([store.queryDeliverySnapshot(),store.queryDeliverySnapshot()]);expect(calls).toBe(1);
  expect((await store.queryDeliverySnapshot('private')).items[0].id).toBe('private');
  expect((await store.queryDeliverySnapshot()).items[0].id).toBe('global');
  store.queryDeliveryWorkbench=async()=>{await new Promise<void>(resolve=>release=resolve);return {records:[],context:{}}};
  const refresh=store.queryDeliverySnapshot(undefined,true);
  expect((await store.queryDeliverySnapshot()).items).toHaveLength(1);
  release();await refresh;expect((await store.queryDeliverySnapshot()).items).toHaveLength(0);
});
test('worker persists failures and does not overlap cycles',async()=>{
  let claims=0;const finished:any[]=[];
  const worker=startDeliveryReportRecovery({store:{claimDeliveryRecovery:async()=>{claims++;return [{...item,job:{attempts:1}}]},finishDeliveryRecovery:async(...args:any[])=>finished.push(args)},fetchPublic:async()=>new Response('',{status:503})});
  await Promise.all([worker.run(),worker.run()]);await worker.stop();
  expect(claims).toBe(1);expect(finished[0][1]).toMatchObject({status:'failed',attempts:1});
});


test('internal workbench reads require a valid service token; writes still require an analyst session', async () => {
  const { InMemoryScraperStore } = await import('../storage/memoryStore.ts');
  const { handleTimelinessRequest } = await import('../api/timelinessRoutes.ts');
  const options:any={store:new InMemoryScraperStore(),serviceToken:'test-service'};
  const request=(path:string,token:string,method='GET')=>handleTimelinessRequest(new Request('http://test/v1/intel/timeliness/'+path,{method,headers:{'x-hanasand-service-token':token}}),options);
  expect((await request('workbench','wrong'))?.status).toBe(401);
  expect((await request('workbench','test-service'))?.status).toBe(200);
  expect((await request('references','test-service','POST'))?.status).toBe(401);
});
