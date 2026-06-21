import type { MarketplaceRow } from "./types.ts";
import { uniqueStrings } from "./utils.ts";
import { buyerSearchCardForRow, buyerSummaryForRow, keyPivotsForRow, recommendedBuyerActionForRow } from "./buyerRows.ts";
import { graphQualityLiftForRow, graphSellableSupportForRow, marketplaceGraphSignalsForRow, paidGraphSearchPackForRow } from "./graphRows.ts";
import { paidRowDecisionFor, whyWorthPayingFor } from "./paidDecision.ts";
import { parserAdmissionRuntimeProofForRow } from "./parserAdmissionProof.ts";

export function withPaidRowDecision(row: MarketplaceRow): MarketplaceRow {
  const parserAdmissionRuntimeProof = parserAdmissionRuntimeProofForRow(row);
  const decision = paidRowDecisionFor(row, parserAdmissionRuntimeProof);
  const graphLift = graphQualityLiftForRow(row, decision, parserAdmissionRuntimeProof);
  const marketplaceGraphSignals = marketplaceGraphSignalsForRow(row, decision, graphLift);
  const paidGraphSearchPack = paidGraphSearchPackForRow(row, decision, graphLift, marketplaceGraphSignals);
  const graphSellableSupport = graphSellableSupportForRow(row, decision, marketplaceGraphSignals, paidGraphSearchPack);
  const whyWorthPaying = whyWorthPayingFor(row, decision);
  return {
    ...row,
    ...decision,
    buyerSummary: buyerSummaryForRow(row, decision, whyWorthPaying),
    recommendedBuyerAction: recommendedBuyerActionForRow(row, decision),
    keyPivots: keyPivotsForRow(row),
    buyerSearchCard: buyerSearchCardForRow(row, decision, whyWorthPaying),
    whyWorthPayingFor: whyWorthPaying,
    ...graphLift,
    marketplaceGraphSignals,
    paidGraphSearchPack,
    graphSellableSupport,
    parserAdmissionRuntimeProof,
    analysisFacets: uniqueStrings([
      ...row.analysisFacets,
      `paid:${decision.paidRowDecision}`,
      `billing:${decision.billingGuidance}`,
      `graph_lift:${graphLift.graphQualityLift}`,
      `marketplace_graph:${marketplaceGraphSignals.signalState}`,
      `paid_graph_pack:${paidGraphSearchPack.exportEligibility}`,
      `graph_support:${graphSellableSupport.sourceFamilyProofState}`,
      `parser_admission:${parserAdmissionRuntimeProof.admissionDecision}`
    ]).sort()
  };
}

