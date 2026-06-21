import type { BlockedDarknetOperation, DarknetNetwork, DarknetProxyType } from "./darknetMetadataTypes.ts";

function config(network: DarknetNetwork, proxyBoundaryId: string, proxyType: DarknetProxyType, maxMetadataBytes: number, requestTimeoutMs: number, maxConcurrency: number) {
  return { network, proxyBoundaryId, maxMetadataBytes, requestTimeoutMs, maxConcurrency, screenshotHashMode: network === "freenet" ? "disabled" : "hash_only", allowedSchemes: ["http:", "https:"], proxyType, timeoutClass: network === "tor" ? "metadata_standard" : "metadata_slow", notes: `${network} metadata only` };
}

export const BLOCKED_OPERATIONS: BlockedDarknetOperation[] = [
  "credential_bypass",
  "captcha_solving",
  "threat_actor_interaction",
  "stolen_file_download",
  "stealth_or_evasion",
  "unapproved_proxy",
  "non_metadata_capture"
];

export const DARKNET_METADATA_NETWORK_CONFIGS = {
  tor: config("tor", "tor-approved-metadata-proxy", "tor_socks", 64_000, 45_000, 2),
  i2p: config("i2p", "i2p-approved-metadata-proxy", "i2p_http", 64_000, 60_000, 1),
  freenet: config("freenet", "freenet-approved-metadata-proxy", "freenet_gateway", 32_000, 90_000, 1)
} as const;
