import type { AttackTactic, AttackTechniqueCandidate, ExtractedEntity, PipelineResult } from "../types.ts";
import { clampScore, stableId } from "../utils.ts";

const TECHNIQUE_HINTS: Array<{ pattern: RegExp; attackId: string; name: string; tactic: AttackTactic }> = [
  { pattern: /\bphishing\b/i, attackId: "T1566", name: "Phishing", tactic: "initial-access" },
  { pattern: /\bcredential dumping\b/i, attackId: "T1003", name: "OS Credential Dumping", tactic: "credential-access" },
  { pattern: /\blateral movement\b/i, attackId: "T1021", name: "Remote Services", tactic: "lateral-movement" },
  { pattern: /\bcommand and control\b/i, attackId: "T1105", name: "Ingress Tool Transfer", tactic: "command-and-control" },
  { pattern: /\bexfiltration\b/i, attackId: "T1041", name: "Exfiltration Over C2 Channel", tactic: "exfiltration" },
  { pattern: /\bpersistence\b/i, attackId: "T1547", name: "Boot or Logon Autostart Execution", tactic: "persistence" }
];

const EXPLICIT_ATTACK_ID = /\bT\d{4}(?:\.\d{3})?\b/i;

export function mapAttackTechniqueCandidates(result: PipelineResult): AttackTechniqueCandidate[] {
  const candidates = new Map<string, AttackTechniqueCandidate>();

  for (const entity of result.entities.filter((item) => item.type === "ttp")) {
    const candidate = techniqueFromEntity(entity);
    if (!candidate) continue;
    candidates.set(candidate.id, candidate);
  }

  return [...candidates.values()];
}

function techniqueFromEntity(entity: ExtractedEntity): AttackTechniqueCandidate | undefined {
  const provenance = entity.provenance ?? [];
  if (provenance.length === 0) return undefined;

  const value = entity.normalizedValue ?? entity.value;
  const explicitId = value.match(EXPLICIT_ATTACK_ID)?.[0].toUpperCase();
  if (explicitId) {
    return {
      id: stableId("attack", explicitId),
      attackId: explicitId,
      name: explicitId,
      tactic: "unknown",
      confidence: clampScore(entity.confidence),
      provenance,
      reviewReasons: ["explicit ATT&CK ID requires analyst technique-name confirmation"]
    };
  }

  const hint = TECHNIQUE_HINTS.find((item) => item.pattern.test(value));
  if (!hint) {
    return {
      id: stableId("attack", `unmapped:${value.toLowerCase()}`),
      name: value,
      tactic: "unknown",
      confidence: clampScore(entity.confidence * 0.75),
      provenance,
      reviewReasons: ["no ATT&CK technique ID assigned from heuristic evidence"]
    };
  }

  return {
    id: stableId("attack", hint.attackId),
    attackId: hint.attackId,
    name: hint.name,
    tactic: hint.tactic,
    confidence: clampScore(entity.confidence * 0.9),
    provenance,
    reviewReasons: entity.confidence < 0.75 ? ["low-confidence ATT&CK mapping"] : []
  };
}
