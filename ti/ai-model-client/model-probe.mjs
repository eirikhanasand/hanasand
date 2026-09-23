import { createConnection } from 'node:net';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { appendFileSync, lstatSync, readFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const fields = ['version', 'nonce', 'host', 'caller', 'method', 'path', 'clientIp', 'clientPort', 'serverIp', 'serverPort',
  'serverPid', 'logSha256', 'startedAt', 'finishedAt', 'previousStartedAt', 'status', 'bodyEmpty', 'responseSha256', 'model', 'responseRoot'];
export const modelProofPayload = proof => JSON.stringify([...fields.map(key => proof[key]), proof.headers?.host, proof.headers?.accept, proof.headers?.connection]);
export const signModelProof = (proof, key) => createHmac('sha256', Buffer.from(key, 'hex')).update(modelProofPayload(proof)).digest('hex');

function ordinaryModelList(body, model) {
  if (!exact(body, ['object', 'data']) || body.object !== 'list' || !Array.isArray(body.data) || body.data.length !== 1) return false;
  const entry = body.data[0];
  if (!exact(entry, ['id', 'object', 'created', 'owned_by', 'root', 'parent', 'max_model_len', 'permission'])
    || entry.id !== model || entry.object !== 'model' || !Number.isSafeInteger(entry.created) || entry.created <= 0
    || entry.owned_by !== 'vllm' || typeof entry.root !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/.test(entry.root) || entry.parent !== null
    || !Number.isSafeInteger(entry.max_model_len) || entry.max_model_len < 1 || entry.max_model_len > 1048576
    || !Array.isArray(entry.permission) || entry.permission.length !== 1) return false;
  const p = entry.permission[0];
  return exact(p, ['id', 'object', 'created', 'allow_create_engine', 'allow_sampling', 'allow_logprobs', 'allow_search_indices',
    'allow_view', 'allow_fine_tuning', 'organization', 'group', 'is_blocking'])
    && /^modelperm-[a-f0-9]{16}$/.test(p.id) && p.object === 'model_permission' && Number.isSafeInteger(p.created) && p.created > 0
    && p.allow_create_engine === false && p.allow_sampling === true && p.allow_logprobs === true
    && p.allow_search_indices === false && p.allow_view === true && p.allow_fine_tuning === false
    && p.organization === '*' && p.group === null && p.is_blocking === false;
}

function configuredKey() {
  try {
    const file = process.env.MODEL_PROBE_VERIFICATION_FILE || '/model-probe-config/verification.json';
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.size > 4096 || (stat.mode & 0o077)) return '';
    const config = JSON.parse(readFileSync(file, 'utf8'));
    return exact(config, ['MODEL_PROBE_PROOF_KEY']) && typeof config.MODEL_PROBE_PROOF_KEY === 'string' ? config.MODEL_PROBE_PROOF_KEY : '';
  } catch { return ''; }
}

export function createModelProbe({ key = process.env.MODEL_PROBE_PROOF_KEY || configuredKey(), directory = process.env.MODEL_PROBE_PROOF_DIR || '', now = Date.now } = {}) {
  const previous = new Map();
  let cleanedHour = '', lastProofAt = null;
  const ready = /^[a-f0-9]{64}$/.test(key) && directory.startsWith('/');
  function persist(proof) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const hour = new Date(proof.finishedAt).toISOString().slice(0, 13);
    const file = join(directory, hour + '.jsonl');
    try { if (statSync(file).size > 8 * 1024 * 1024) return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    appendFileSync(file, JSON.stringify({ ...proof, mac: signModelProof(proof, key) }) + '\n', { mode: 0o600 });
    lastProofAt = proof.finishedAt;
    if (cleanedHour !== hour) {
      cleanedHour = hour;
      for (const name of readdirSync(directory)) if (/^\d{4}-\d{2}-\d{2}T\d{2}\.jsonl$/.test(name)
        && Date.parse(name.slice(0, 13) + ':00:00Z') < proof.finishedAt - 7 * 86400000) unlinkSync(join(directory, name));
    }
  }
  async function probe(baseUrl, model) {
    const url = new URL('/v1/models', baseUrl);
    // Unconfigured/remote endpoints retain the previous health-check behavior.
    if (!ready || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !Number.isInteger(Number(url.port)) || Number(url.port) < 1 || Number(url.port) > 65535) {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
      return { ok: response.ok, status: response.status, body: await response.json().catch(() => undefined) };
    }
    const nonce = randomUUID(), path = `/v1/models?hanasand_probe=${nonce}`, startedAt = now();
    const previousStartedAt = previous.get(url.port) ?? null;
    previous.set(url.port, startedAt);
    const inspected = await new Promise((resolve, reject) => {
      const socket = createConnection({ host: '127.0.0.1', port: Number(url.port) });
      const timer = setTimeout(() => socket.destroy(new Error('Model probe timed out')), 1500);
      const chunks = []; let size = 0, peer;
      socket.once('connect', () => {
        peer = { clientIp: socket.localAddress, clientPort: socket.localPort, serverIp: socket.remoteAddress, serverPort: socket.remotePort };
        socket.write(`GET ${path} HTTP/1.1\r\nHost: ${url.host}\r\nAccept: application/json\r\nConnection: close\r\n\r\n`);
      });
      socket.once('error', error => { clearTimeout(timer); reject(error); });
      socket.on('data', chunk => {
        size += chunk.length;
        if (size > 73728) { socket.destroy(new Error('Model probe response too large')); return; }
        chunks.push(chunk);
      });
      socket.once('end', () => {
        clearTimeout(timer);
        const wire = Buffer.concat(chunks), separator = wire.indexOf('\r\n\r\n'), finishedAt = now();
        if (separator < 0 || separator > 8192) { reject(new Error('Invalid model probe response')); return; }
        const lines = wire.subarray(0, separator).toString('latin1').split('\r\n'), statusLine = lines.shift();
        const status = Number(/^HTTP\/1\.[01] ([0-9]{3}) /.exec(statusLine || '')?.[1]);
        const raw = wire.subarray(separator + 4), responseHeaders = {}, responseNames = [];
        let headerSyntax = true;
        for (const line of lines) {
          const match = /^([a-zA-Z0-9-]+): ([^\r\n]*)$/.exec(line);
          if (!match) { headerSyntax = false; continue; }
          const name = match[1].toLowerCase(); responseNames.push(name); responseHeaders[name] = match[2];
        }
        let body; try { body = JSON.parse(raw.toString('utf8')); } catch { /* Unrecognized body cannot produce proof. */ }
        const headers = { host: url.host, accept: 'application/json', connection: 'close' };
        const valid = peer?.clientIp === '127.0.0.1' && peer.serverIp === '127.0.0.1' && peer.serverPort === Number(url.port)
          && /^HTTP\/1\.1 [1-5]\d\d [A-Za-z ]+$/.test(statusLine || '') && finishedAt >= startedAt
          && headerSyntax && new Set(responseNames).size === responseNames.length && responseNames.length === 5
          && responseNames.every(name => ['date', 'server', 'content-length', 'content-type', 'connection'].includes(name))
          && responseHeaders.connection === 'close' && responseHeaders.server === 'uvicorn' && responseHeaders['content-type'] === 'application/json'
          && responseHeaders['content-length'] === String(raw.length) && Number.isFinite(Date.parse(responseHeaders.date || ''))
          && JSON.stringify(body) === raw.toString('utf8') && ordinaryModelList(body, model);
        if (valid) {
          const proof = { version: 1, nonce, host: 'inspur', caller: 'hanasand-ai-model-client', method: 'GET', path, ...peer,
            serverPid: null, logSha256: null, startedAt, finishedAt, previousStartedAt, status, bodyEmpty: true,
            responseSha256: createHash('sha256').update(raw).digest('hex'), model, responseRoot: body.data[0].root, headers };
          try { persist(proof); } catch { /* Missing proof keeps the access event; health checks still complete. */ }
        }
        resolve({ ok: status >= 200 && status < 300, status, body, transferEncoding: responseHeaders['transfer-encoding'] });
      });
    });
    // Preserve normal fetch decoding for an unexpected transfer encoding; no proof
    // exists for either request, so both access records remain stored.
    if (inspected.transferEncoding) {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(1500) });
      return { ok: response.ok, status: response.status, body: await response.json().catch(() => undefined) };
    }
    return inspected;
  }

  return { probe, state: () => ({ configured: ready, lastProofAt }) };
}
