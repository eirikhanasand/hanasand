import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = String(29000 + Math.floor(Math.random() * 1000));
const child = spawn(process.execPath, ["ti/ai-parser-bridge/server.mjs"], {
  cwd: new URL("../..", import.meta.url),
  env: {
    ...process.env,
    HANASAND_AI_BRIDGE_PORT: port,
    HANASAND_AI_MODELS_URL: "http://127.0.0.1:9/api/ai/models",
  },
  stdio: "ignore",
});

try {
  const health = await waitFor(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status, 200);
  const ready = await fetch(`http://127.0.0.1:${port}/ready`);
  assert.equal(ready.status, 502);
} finally {
  child.kill("SIGTERM");
}

async function waitFor(url) {
  const deadline = Date.now() + 3000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(500) });
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw lastError;
}
