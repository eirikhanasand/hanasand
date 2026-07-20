import { startScraperRuntime } from "./runtime/startup.ts";

const runtime = await startScraperRuntime();
let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;
  await runtime.stop();
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);
