import { startReadinessWorker } from "../../api/readiness.ts";
let healthy = true;
let delaySample = false;
const readiness = startReadinessWorker({
  hostname: "127.0.0.1", port: 0,
  sample: async () => {
    if (delaySample) await Bun.sleep(700);
    return Response.json({ ok: healthy }, { status: healthy ? 200 : 503 });
  }
});
const control = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/block") setTimeout(() => Bun.sleepSync(1500), 10);
  if (path === "/down") healthy = false;
  if (path === "/up") healthy = true;
  if (path === "/delay") delaySample = true;
  return new Response("ok");
} });
console.log(JSON.stringify({ health: await readiness.ready, control: control.port }));
