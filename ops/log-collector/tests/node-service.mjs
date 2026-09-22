import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

test('bundled Node service delivers legacy queue plus live journal/audit/Docker across worker threads', { timeout: 20000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'collector-service-')), state = path.join(root, 'state'), bin = path.join(root, 'bin'), cfg = path.join(root, 'config.json');
  fs.mkdirSync(state); fs.mkdirSync(bin); const received = [];
  const server = http.createServer(async (req, res) => { const buffers = []; for await (const chunk of req) buffers.push(chunk); const events = JSON.parse(Buffer.concat(buffers)).events; received.push(...events); res.writeHead(201, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, accepted: events.length })); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const now = new Date().toISOString(), log = path.join(root, 'docker.log'); fs.writeFileSync(log, JSON.stringify({ log: 'bundled-docker\n', time: now, stream: 'stdout' }) + '\n');
  fs.writeFileSync(cfg, JSON.stringify({ host: 'bundled-fixture', start: new Date(Date.now() - 60000).toISOString(), token: 'synthetic-fixture-token', url: `http://127.0.0.1:${server.address().port}/ingest` }));
  function executable(name, output) { const file = path.join(bin, name); fs.writeFileSync(file, '#!/bin/sh\n' + output); fs.chmodSync(file, 0o755); }
  executable('journalctl', `printf '%s\\n' '${JSON.stringify({ __CURSOR: 'fixture-next', __REALTIME_TIMESTAMP: String(Date.now() * 1000), MESSAGE: 'bundled-journal' })}'\n`);
  executable('ausearch', `printf '%s\\n' 'type=SYSCALL msg=audit(${Date.now() / 1000}:123): success=yes exe="/usr/bin/whoami"' 'type=EXECVE msg=audit(${Date.now() / 1000}:123): argc=1 a0="whoami"'\n`);
  executable('docker', `case "$1" in ps) echo 'fixture app';; inspect) printf '%s\\n' '${JSON.stringify({ path: log, driver: 'json-file' })}';; esac\n`);
  fs.mkdirSync(path.join(state, 'queue/live'), { recursive: true });
  fs.writeFileSync(path.join(state, 'queue/live', '01789999999999999999-legacy.json'), JSON.stringify({ events: [{ sourceEventId: 'legacy-stable', host: 'bundled-fixture', service: 'legacy', message: 'pending-python-batch', timestamp: now, level: 'info', metadata: {} }] }));
  fs.writeFileSync(path.join(state, 'journal.json'), JSON.stringify({ cursor: 'python-cursor', since: now }));
  const child = spawn(process.execPath, [path.resolve('dist/collector.cjs')], { env: { ...process.env, PATH: bin + ':' + process.env.PATH, HANASAND_LOG_CONFIG: cfg, HANASAND_LOG_STATE: state, HANASAND_COLLECTOR_RELEASE: 'fixture-revision' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; }); const done = once(child, 'exit');
  try {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !['pending-python-batch', 'bundled-journal', 'bundled-docker', 'whoami'].every(message => received.some(event => event.message === message))) { assert.equal(child.exitCode, null, output); await sleep(100); }
    for (const message of ['pending-python-batch', 'bundled-journal', 'bundled-docker', 'whoami']) assert.ok(received.some(event => event.message === message), message + ': ' + output);
    assert.equal(received.find(event => event.message === 'pending-python-batch').sourceEventId, 'legacy-stable');
    assert.equal(JSON.parse(fs.readFileSync(path.join(state, 'journal.json'))).cursor, 'fixture-next');
    assert.equal(JSON.parse(fs.readFileSync(path.join(state, 'health.json'))).runtime, 'typescript');
    assert.equal(fs.existsSync(path.join(state, 'queue/live/01789999999999999999-legacy.json')), false);
  } finally { child.kill('SIGTERM'); await done; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true, force: true }); }
});
