export function startReadinessWorker(options: {
  port: number;
  hostname: string;
  sample: () => Promise<Response>;
}) {
  const worker = new Worker(new URL("./readinessWorker.ts", import.meta.url).href);
  const ready = new Promise<number>((resolve, reject) => {
    worker.addEventListener("message", ({ data }) => {
      if (data.type === "listening") resolve(data.port);
    });
    worker.addEventListener("error", (error) => reject(new Error(error.message)));
  });
  worker.postMessage({ type: "listen", hostname: options.hostname, port: options.port });
  let sampling = false;
  let stopped = false;
  const sample = async () => {
    if (sampling || stopped) return;
    sampling = true;
    // Include time spent sampling; a delayed sample must not renew the readiness lease.
    const sentAt = performance.timeOrigin + performance.now();
    try {
      const response = await options.sample();
      const body = await response.text();
      if (!stopped) worker.postMessage({ type: "snapshot", sentAt, status: response.status, body });
    } catch {
      // Missing/failed samples expire to 503 on the worker's independent event loop.
    } finally { sampling = false; }
  };
  const timer = setInterval(sample, 50);
  void sample();
  return {
    ready,
    async stop() {
      stopped = true;
      clearInterval(timer);
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 1_000);
        worker.addEventListener("message", ({ data }) => {
          if (data.type === "stopped") { clearTimeout(timeout); resolve(); }
        });
        worker.postMessage({ type: "stop" });
      });
      worker.terminate();
    }
  };
}
