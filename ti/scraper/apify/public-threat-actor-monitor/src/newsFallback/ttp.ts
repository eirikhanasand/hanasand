export function inferNewsTtp(title: string): { name: string; tactic: string; attackId?: string } {
  const lower = title.toLowerCase();
  if (lower.includes("phish")) return { name: "Phishing", tactic: "Initial Access", attackId: "T1566" };
  if (lower.includes("credential")) return { name: "Credential Access", tactic: "Credential Access" };
  if (lower.includes("ransom")) return { name: "Data Encrypted for Impact", tactic: "Impact", attackId: "T1486" };
  if (lower.includes("malware")) return { name: "Malware", tactic: "Execution" };
  if (lower.includes("exploit") || lower.includes("cve")) return { name: "Exploit Public-Facing Application", tactic: "Initial Access", attackId: "T1190" };
  if (lower.includes("cloud")) return { name: "Cloud Service Discovery", tactic: "Discovery", attackId: "T1526" };
  return { name: "Public reporting monitor", tactic: "Reconnaissance" };
}

export function inferClaimType(title: string): "campaign" | "malware_activity" | "vulnerability_exploitation" | "general_activity" {
  const lower = title.toLowerCase();
  if (lower.includes("malware") || lower.includes("stealer") || lower.includes("rat")) return "malware_activity";
  if (lower.includes("exploit") || lower.includes("cve")) return "vulnerability_exploitation";
  if (lower.includes("campaign") || lower.includes("attack") || lower.includes("targets")) return "campaign";
  return "general_activity";
}
