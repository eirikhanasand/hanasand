import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { fs, Store, Config, Metadata, Delivery, iso, sleep, event, collectionError } from './core';
import { Sources } from './sources';
import { guests, guestExport, guestAck, printRecent } from './guests';
import { configure, applyRetention } from './configuration';

const sources = ['audit', 'journal', 'docker', 'docker_file_history', 'docker_file_live', 'guests'] as const;
interface Status { ok: boolean; checkedAt: string; error?: string; [key: string]: string | number | boolean | undefined }
const configPath = process.env.HANASAND_LOG_CONFIG || '/etc/hanasand/log-collector.json';
async function worker(name: string) {
  const store = new Store(), config: Config = JSON.parse(fs.readFileSync(configPath, 'utf8')), source = new Sources(store);
  if (name.startsWith('delivery_')) {
    const lane = name.slice('delivery_'.length), delivery = new Delivery(config);
    while (true) {
      try {
        const paths = store.queuedBatches(lane); if (!paths.length) { await sleep(250); continue; }
        const count = await delivery.deliver(paths), age = Math.max(0, Date.now() / 1000 - Number(paths[0].split('/').pop()!.split('-')[0]) / 1e9);
        const status: Status = { ok: lane !== 'live' || age < 10, checkedAt: iso(), accepted: count, queueAgeSeconds: age };
        if (!status.ok) status.error = 'Live log delivery exceeded 10 seconds'; parentPort!.postMessage(status);
      } catch (error) { parentPort!.postMessage({ ok: false, checkedAt: iso(), error: collectionError(error) }); await sleep(1000); }
    }
  }
  const work: Record<string, [() => Promise<unknown>, number]> = {
    audit: [() => source.audit(config), 5000], journal: [() => source.journal(config), 1000], docker: [() => source.docker(config), 5000],
    docker_file_history: [() => source.dockerFileSource(config), 250], docker_file_live: [() => source.dockerFileSource(config, true), 100],
    guests: [() => guests(store, config), 30000], audit_live: [() => source.audit(config, true), 1000], journal_live: [() => source.journal(config, true), 1000],
  };
  const [run, interval] = work[name];
  while (true) {
    try { const details = await run(); parentPort!.postMessage({ ok: true, checkedAt: iso(), ...(details && typeof details === 'object' ? details : {}) }); }
    catch (error) { parentPort!.postMessage({ ok: false, checkedAt: iso(), error: collectionError(error) }); }
    await sleep(interval);
  }
}
async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--configure') { configure(args[1], args[2], args[3]); return; }
  if (args[0] === '--retention') { await applyRetention(); return; }
  if (args[0] === '--version') { console.log('hanasand-log-collector typescript ' + (process.env.HANASAND_COLLECTOR_RELEASE || 'development')); return; }
  const store = new Store();
  if (args[0] === '--export') { await guestExport(store, { host: args[1], start: args[2] }); return; }
  if (args[0] === '--ack') { guestAck(store, args[1]); return; }
  if (args[0] === '--recent') { await printRecent(store, { host: args[1] }); return; }
  if (args.length) throw new Error('Unknown collector option');
  const config: Config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  // Fail before starting source workers if configuration cannot deliver their queue.
  new Delivery(config).close();
  const statuses: Record<string, Status> = {}, workers: Worker[] = [];
  for (const name of ['delivery_live', 'delivery_history', ...sources, 'audit_live', 'journal_live']) {
    const thread = new Worker(process.argv[1], { workerData: { name } }); workers.push(thread);
    thread.on('message', status => { statuses[name] = status; });
    thread.on('error', error => { statuses[name] = { ok: false, checkedAt: iso(), error: collectionError(error) }; });
    // A dead worker must not leave a permanently green status. systemd restarts
    // the whole collector; durable queues and cursors make that replay safe.
    thread.on('exit', () => { process.stderr.write(name + ' worker exited\n'); process.exit(1); });
  }
  const shutdown = () => process.exit(0); process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
  while (true) {
    const snapshot = { ...statuses }, failures = Object.entries(snapshot).filter(([, status]) => !status.ok).map(([name, status]) => name + ': ' + status.error);
    const coverage = store.load<{ checkedAt: string; failures: string[]; instances: { status: string }[] } | null>('guest-coverage.json', null);
    if (coverage?.failures.length && !failures.some(item => item.startsWith('guests:'))) failures.push('guests: ' + coverage.failures.join(', '));
    const health: Record<string, boolean | null> = Object.fromEntries(sources.map(name => [name, snapshot[name]?.ok ?? null]));
    const metadata: Metadata = { collector_health: health, source_status: JSON.parse(JSON.stringify(snapshot)) };
    store.save('health.json', { checkedAt: iso(), release: process.env.HANASAND_COLLECTOR_RELEASE || 'development', runtime: 'typescript', ...metadata });
    if (coverage) metadata.guest_coverage = { checkedAt: coverage.checkedAt, running: coverage.instances.filter(g => g.status === 'Running').length, stopped: coverage.instances.filter(g => g.status !== 'Running').length, failures: coverage.failures, enrollment: 'Stopped guests are enrolled when next running.' };
    const message = failures.length ? 'Collection failed: ' + failures.join(', ') : Object.values(health).includes(null) ? 'Collection starting' : 'Collection healthy';
    try { await store.send([event(config, 'health:' + Math.floor(Date.now() / 30000), 'host-log-collector', message, iso(), metadata, failures.length ? 'error' : 'info')]); }
    catch { failures.push('delivery failed'); }
    if (failures.length) console.log(failures.join('; '));
    await sleep(30000);
  }
}
// Bundled CommonJS is both the service executable and each source worker.
if (!isMainThread) void worker(workerData.name).catch(error => { console.error(collectionError(error)); process.exit(1); });
else if (require.main === module) void main().catch(error => { console.error(collectionError(error)); process.exit(1); });
