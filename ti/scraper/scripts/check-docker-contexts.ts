import { assertDockerContextsWithinLimits, defaultDockerContextLimits, estimateDockerContext } from "../src/ops/dockerContext.ts";

const repoRoot = new URL("../../", import.meta.url).pathname.replace(/\/ti\/$/, "");
const estimates = defaultDockerContextLimits(repoRoot).map(estimateDockerContext);

for (const estimate of estimates) {
  console.log(JSON.stringify({
    event: "docker_context.estimate",
    name: estimate.name,
    contextDir: estimate.contextDir,
    totalBytes: estimate.totalBytes,
    includedFiles: estimate.includedFiles,
    ignoredEntries: estimate.ignoredEntries,
    maxBytes: estimate.maxBytes,
    status: estimate.status
  }));
}

assertDockerContextsWithinLimits(estimates);
