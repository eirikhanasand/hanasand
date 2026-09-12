// A separate event loop keeps readiness responsive when collection blocks the API thread.
// Freshness is checked when responding, never extended by receiving an old queued message.
import { RUNTIME_HEARTBEAT_TIMEOUT_MS } from "./readiness.ts";
let snapshot: { sentAt: number; status: number; body: string } | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
const clock = () => performance.timeOrigin + performance.now();

self.onmessage = ({ data }) => {
  if (data.type === "listen") {
    server = Bun.serve({
      hostname: data.hostname,
      port: data.port,
      fetch(request) {
        if (new URL(request.url).pathname !== "/v1/health") return new Response("Not found", { status: 404 });
        if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
        const age = snapshot ? clock() - snapshot.sentAt : Infinity;
        const fresh = age >= 0 && age < RUNTIME_HEARTBEAT_TIMEOUT_MS;
        return new Response(fresh ? snapshot!.body : JSON.stringify({
          ok: false, service: "ti-scraper",
          error: { code: "runtime_unresponsive", message: "The serving runtime has no fresh readiness heartbeat." }
        }), {
          status: fresh ? snapshot!.status : 503,
          headers: {
            "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
            "x-ti-runtime-heartbeat-age-ms": Number.isFinite(age) ? String(Math.round(age)) : "unavailable",
            "x-ti-runtime-heartbeat-timeout-ms": String(RUNTIME_HEARTBEAT_TIMEOUT_MS)
          }
        });
      }
    });
    self.postMessage({ type: "listening", port: server.port });
  } else if (data.type === "stop") {
    server?.stop(true);
    self.postMessage({ type: "stopped" });
    self.close();
  } else if (data.type === "snapshot") {
    snapshot = data;
  }
};
