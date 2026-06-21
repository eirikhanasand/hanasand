import { startScraperRuntime } from "./runtime/startup.ts";

const runtime = startScraperRuntime();

process.on("SIGTERM", () => runtime.stop());
