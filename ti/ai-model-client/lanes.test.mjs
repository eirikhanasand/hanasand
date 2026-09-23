import { expect, test } from 'bun:test';
import { createLanePool, modelEndpoints } from './lanes.mjs';

test('rotates healthy lanes, respects capacity, and releases reservations once', () => {
  expect(() => createLanePool(NaN)).toThrow('positive integer');
  const pool = createLanePool(1), urls = ['a', 'b'];
  const first = pool.acquire(urls), second = pool.acquire(urls);
  expect([first.url, second.url]).toEqual(urls);
  expect(pool.stats('a')).toMatchObject({ activeRequests: 1, availableRequests: 0 });
  expect(() => pool.acquire(urls)).toThrow('busy');
  first.release(); first.release();
  expect(pool.activeRequests).toBe(1);
  const next = pool.acquire(urls);
  expect(next.url).toBe('a');
  next.release(); second.release();
  expect(pool.activeRequests).toBe(0);
});

test('the model client routes concurrent prompts and releases failed lanes', async () => {
  const calls = [0, 0], gates = [[], []], statuses = [200, 200], messages = [];
  const servers = [0, 1].map(index => Bun.serve({ port: 0, async fetch(request) {
    if (new URL(request.url).pathname === '/v1/models') return Response.json({ data: [{ id: 'hanasand' }] });
    await request.json();
    calls[index]++;
    await new Promise(resolve => gates[index].push(resolve));
    return Response.json({ choices: [{ message: { content: `lane-${index}` } }] }, { status: statuses[index] });
  } }));
  let socket;
  const api = Bun.serve({ port: 0, fetch(request, server) { if (server.upgrade(request)) return; return new Response('', { status: 404 }); },
    websocket: { open(ws) { socket = ws; }, message(_ws, data) { messages.push(JSON.parse(String(data))); } } });
  const child = Bun.spawn([process.execPath, new URL('./client.mjs', import.meta.url).pathname], { stdout: 'ignore', stderr: 'pipe', env: {
    ...process.env, HANASAND_AI_CLIENT_HEALTH_PORT: '0', HANASAND_AI_CLIENT_API_WS: `ws://127.0.0.1:${api.port}`,
    HANASAND_AI_OPENAI_BASE: `http://127.0.0.1:${servers[0].port}`, HANASAND_AI_MODEL_LANE_PORTS: servers.map(server => server.port).join(','),
    HANASAND_AI_MODEL_MAX_REQUESTS: '1', HANASAND_AI_MODEL: 'hanasand',
  } });
  const waitFor = async predicate => {
    const deadline = Date.now() + 5000;
    while (!predicate()) { if (Date.now() > deadline) throw Error('Model client test timed out'); await Bun.sleep(5); }
  };
  const send = id => socket.send(JSON.stringify({ type: 'prompt_request', conversationId: id, messages: [{ role: 'user', content: 'test' }] }));
  try {
    await waitFor(() => socket && messages.some(message => message.client?.lanes?.length === 2));
    send('first'); send('second'); send('busy');
    await waitFor(() => calls[0] === 1 && calls[1] === 1 && messages.some(message => message.type === 'prompt_error' && message.conversationId === 'busy'));
    expect(messages.some(message => message.client?.lanes?.every(lane => lane.activeRequests === 1 && lane.availableRequests === 0))).toBe(true);
    statuses[0] = 503; gates[0].shift()();
    await waitFor(() => messages.some(message => message.type === 'prompt_error' && message.conversationId === 'first'));
    statuses[0] = 200; send('after-failure');
    await waitFor(() => calls[0] === 2);
    gates[0].shift()(); gates[1].shift()();
    await waitFor(() => messages.filter(message => message.type === 'prompt_complete').length === 2);
    expect(calls).toEqual([2, 1]);
    expect(messages.filter(message => message.type === 'prompt_complete').map(message => message.content).sort()).toEqual(['lane-0', 'lane-1']);
    await waitFor(() => messages.at(-1)?.client?.lanes?.every(lane => lane.activeRequests === 0 && lane.availableRequests === 1));
  } finally {
    child.kill(); await child.exited;
    for (const queue of gates) for (const release of queue) release();
    for (const server of servers) server.stop(true);
    api.stop(true);
  }
}, 15_000);

test('removed lanes get no new requests and custom endpoints stay authoritative', () => {
  const pool = createLanePool(2), first = pool.acquire(['a', 'b']);
  expect(pool.acquire(['b']).url).toBe('b');
  first.release();
  expect(() => pool.acquire([])).toThrow('healthy');
  expect(modelEndpoints('http://127.0.0.1:18081', [18081, 18082, 18082])).toEqual(['http://127.0.0.1:18081/', 'http://127.0.0.1:18082/']);
  expect(modelEndpoints('https://models.example:8443', [18081, 18082])).toEqual(['https://models.example:8443']);
  expect(modelEndpoints('http://127.0.0.1:9999', [18081, 18082])).toEqual(['http://127.0.0.1:9999']);
});
