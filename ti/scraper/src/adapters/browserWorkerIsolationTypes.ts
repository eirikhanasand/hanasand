export interface BrowserWorkerIsolationConfig {
  enabled: boolean;
  maxWorkers: number;
  memoryCapMb: number;
  timeoutMs: number;
  allowedHosts: string[];
  robotsAllowed: boolean;
  legalNotes?: string;
}

export interface BrowserWorkerCaptureInput {
  url: string;
  finalUrl?: string;
  html?: string;
  text?: string;
  screenshotBytes?: Uint8Array;
  contentType?: string;
  durationMs?: number;
}

export interface BrowserWorkerCaptureContract {
  status: "ready" | "blocked";
  failureCategory?: "timeout" | "robots_policy_hold" | "policy_hold" | "unsupported_media" | "content_too_large" | "unavailable" | "source_disabled";
  finalUrl?: string;
  textHash?: string;
  htmlHash?: string;
  screenshotHash?: string;
  extractionStatus: "ready_for_extraction" | "blocked";
  notes: string[];
}
