export type PublicSignalSourceFamily =
  | "public_channel" | "github_advisory" | "cert_government" | "vendor_report"
  | "malware_report_feed" | "public_research_feed" | "public_social"
  | "clear_web" | "darkweb_metadata";
export type PublicSignalMatchedEntities = Record<string, string[]>;
export type PublicSignalDeltaDto = any;
export type PublicAdvisorySignalRecord = any;
export type PublicSignalFusionInput = any;
