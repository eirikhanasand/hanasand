import type { AttackTactic } from "../types.ts";

export const TECHNIQUE_HINTS: Array<{ pattern: RegExp; attackId: string; name: string; tactic: AttackTactic }> = [
  { pattern: /\bphishing\b/i, attackId: "T1566", name: "Phishing", tactic: "initial-access" },
  { pattern: /\bcredential dumping\b/i, attackId: "T1003", name: "OS Credential Dumping", tactic: "credential-access" },
  { pattern: /\blateral movement\b/i, attackId: "T1021", name: "Remote Services", tactic: "lateral-movement" },
  { pattern: /\bcommand and control\b/i, attackId: "T1105", name: "Ingress Tool Transfer", tactic: "command-and-control" },
  { pattern: /\bexfiltration\b/i, attackId: "T1041", name: "Exfiltration Over C2 Channel", tactic: "exfiltration" },
  { pattern: /\bpersistence\b/i, attackId: "T1547", name: "Boot or Logon Autostart Execution", tactic: "persistence" }
];
