import { assertDeployHygiene, checkDeployHygiene } from "../src/ops/deployHygiene.ts";

const repoRoot = new URL("../../", import.meta.url).pathname.replace(/\/ti\/$/, "");
const report = checkDeployHygiene(repoRoot);

for (const check of report.checks) {
  console.log(JSON.stringify({
    event: "deploy_hygiene.check",
    name: check.name,
    ok: check.ok,
    message: check.message
  }));
}

assertDeployHygiene(report);
