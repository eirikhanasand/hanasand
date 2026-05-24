import { assertCutoverRehearsalPass, evaluateCutoverRehearsal } from "../src/ops/liveSearch.ts";
import type { CutoverRehearsalInput } from "../src/ops/liveSearch.ts";

const filePath = Bun.argv[2] ?? process.env.CUTOVER_REHEARSAL_FILE;

if (!filePath) {
  throw new Error("provide a cutover rehearsal JSON file path as argv[2] or CUTOVER_REHEARSAL_FILE");
}

const input = JSON.parse(await Bun.file(filePath).text()) as CutoverRehearsalInput;
const report = evaluateCutoverRehearsal(input);

console.log(JSON.stringify({
  event: "cutover_rehearsal.summary",
  ok: report.ok,
  decision: report.decision,
  requiredPublicProofQueries: report.requiredPublicProofQueries,
  resourceBudget: report.resourceBudget,
  rollbackPath: report.rollbackPath,
  lastKnownGoodState: report.lastKnownGoodState,
  blockers: report.blockers
}));

assertCutoverRehearsalPass(report);
