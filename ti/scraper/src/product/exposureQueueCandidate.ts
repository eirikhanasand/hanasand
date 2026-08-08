import type { RawCapture, SourceRecord } from "../types.ts";

const EXPOSURE_SOURCE_RE = /\b(victim feed|ransomware\.live victim|ransomlook|leak site|extortion|darkweb|darknet|actor claim|tor_metadata|i2p_metadata|freenet_metadata)\b/i;

export function mayContainExposureQueueClaim(capture: RawCapture, source?: SourceRecord) {
  if (capture.metadata?.exposureClaim || capture.metadata?.leakSite) return true;
  return EXPOSURE_SOURCE_RE.test(`${capture.sourceId} ${source?.name ?? ""} ${source?.metadata?.sourceFamily ?? ""}`);
}
