import {
  assertCutoverApplyPlanPass,
  buildCutoverApplyPlanPacket,
  buildCutoverPromotionPacket,
  evaluateCutoverRehearsal
} from "../src/ops/liveSearch.ts";
import type { CutoverApplyPlanInput, CutoverPromotionPacketInput, CutoverRehearsalInput } from "../src/ops/liveSearch.ts";
import { buildLiveInput, mountedRouteProofsFromRecord } from "./cutover-apply-plan/liveInput.ts";

const args = Bun.argv.slice(2);
const allowNonPass = args.includes("--allow-non-pass") || process.env.CUTOVER_ALLOW_NON_PASS === "true";
const liveMode = args.includes("--live");
const filePath = args.find((arg) => !arg.startsWith("--")) ?? process.env.CUTOVER_APPLY_PLAN_FILE;

if (!filePath && !liveMode) {
  throw new Error("provide a cutover apply-plan JSON file path, CUTOVER_APPLY_PLAN_FILE, or --live");
}

const parsed = liveMode
  ? await buildLiveInput()
  : JSON.parse(await Bun.file(filePath as string).text()) as CutoverApplyPlanInput | CutoverRehearsalInput;
const input = normalizeInput(parsed);
const packet = buildCutoverApplyPlanPacket(input);
const promotionPacket = buildCutoverPromotionPacket(input);

console.log(packet.dryRunOutput);
console.log(promotionPacket.leaderMarkdown);
console.log(JSON.stringify({
  event: "cutover_apply_plan.summary",
  ok: packet.ok,
  decision: packet.decision,
  classificationCounts: packet.classificationCounts,
  resourceBudget: packet.resourceBudget,
  blockers: packet.blockers,
  promotionPacket
}));

if (!allowNonPass) assertCutoverApplyPlanPass(packet);

function normalizeInput(input: CutoverPromotionPacketInput | CutoverApplyPlanInput | CutoverRehearsalInput): CutoverPromotionPacketInput {
  if ("rehearsal" in input) return input;
  return {
    rehearsal: evaluateCutoverRehearsal(input),
    actions: [],
    deploymentDrift: input.deploymentDrift,
    agent09ApiReady: input.agent09ApprovedFallbackRemoval,
    resourceBudget: input.resourceBudget,
    leaderThreadContext: "derived from cutover rehearsal input",
    workstreams: input.workstreams,
    livePublicProofs: input.livePublicProofs,
    apiSearchProofs: input.apiSearchProofs,
    mountedRouteProofs: mountedRouteProofsFromRecord(input)
  };
}
