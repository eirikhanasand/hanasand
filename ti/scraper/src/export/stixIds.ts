// @ts-nocheck
export function kindForEntity(type: string): string {
  if (type === "actor") return "intrusion-set";
  if (type === "cve") return "vulnerability";
  if (type === "malware" || type === "tool" || type === "vulnerability") return type;
  if (type === "ttp") return "attack-pattern";
  return "identity";
}

export function indicatorPattern(type: string, value: string): string {
  if (type === "ipv4") return `[ipv4-addr:value = '${value}']`;
  if (type === "domain") return `[domain-name:value = '${value}']`;
  if (type === "url") return `[url:value = '${value}']`;
  return `[artifact:payload_bin MATCHES '${value}']`;
}

export function stixConfidence(confidence: number): number {
  return Math.max(0, Math.min(100, Math.round(confidence * 100)));
}

export function stixId(type: string, value: string): string {
  return `${type}--${uuid(value)}`;
}

function uuid(value: string): string {
  const hex = Array.from({ length: 4 }, (_, index) => Bun.hash(`${value}:${index}`).toString(16).padStart(16, "0")).join("").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${(8 + Number.parseInt(hex[16] ?? "0", 16) % 4).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
