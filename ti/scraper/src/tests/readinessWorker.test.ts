import { expect, test } from "bun:test";
import { startReadinessWorker } from "../api/readiness.ts";

test("readiness fails closed before a sample and closes its listener on stop", async () => {
  const readiness = startReadinessWorker({ port: 0, hostname: "127.0.0.1", sample: () => new Promise(() => {}) });
  const url = `http://127.0.0.1:${await readiness.ready}/v1/health`;
  try {
    expect((await fetch(url)).status).toBe(503);
    expect((await fetch(url, { method: "POST" })).status).toBe(405);
    expect((await fetch(url.replace("/v1/health", "/other"))).status).toBe(404);
  } finally { await readiness.stop(); }
  await Bun.sleep(50);
  await expect(fetch(url, { signal: AbortSignal.timeout(500) })).rejects.toThrow();
});

test("readiness stays responsive and expires during a blocked serving runtime, then recovers", async () => {
  const child = Bun.spawn([process.execPath, new URL("./fixtures/readinessRuntime.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "inherit" });
  try {
    const reader = child.stdout.getReader();
    const { value } = await reader.read();
    const ports = JSON.parse(new TextDecoder().decode(value).trim());
    const url = `http://127.0.0.1:${ports.health}/v1/health`;
    const control = (action: string) => fetch(`http://127.0.0.1:${ports.control}/${action}`);
    await Bun.sleep(100);
    expect((await fetch(url)).status).toBe(200);
    await control("down");
    await Bun.sleep(100);
    expect((await fetch(url)).status).toBe(503);
    await control("up");
    await Bun.sleep(100);
    expect((await fetch(url)).status).toBe(200);
    await control("block");
    await Bun.sleep(400);
    // A brief pause must not be mistaken for an unavailable service.
    expect((await fetch(url)).status).toBe(200);
    await Bun.sleep(1200);
    await control("stall");
    await Bun.sleep(5500);
    const started = performance.now();
    const stalled = await fetch(url);
    expect(stalled.status).toBe(503);
    expect(await stalled.json()).toMatchObject({ error: { code: "runtime_unresponsive" } });
    // A generous CI bound still detects accidentally serving on the blocked event loop (1.1s).
    expect(performance.now() - started).toBeLessThan(100);
    await Bun.sleep(1200);
    expect((await fetch(url)).status).toBe(200);
    await control("delay");
    await Bun.sleep(5500);
    expect((await fetch(url)).status).toBe(503);
    await Bun.sleep(750);
    // Delivery of a six-second-old successful sample cannot renew the lease.
    expect((await fetch(url)).status).toBe(503);
  } finally { child.kill(); await child.exited; }
}, 20_000);
