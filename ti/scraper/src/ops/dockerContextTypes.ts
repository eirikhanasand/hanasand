export interface DockerContextLimit {
  name: string;
  contextDir: string;
  dockerignorePath?: string;
  maxBytes: number;
}

export interface DockerContextEstimate {
  name: string;
  contextDir: string;
  dockerignorePath?: string;
  totalBytes: number;
  includedFiles: number;
  ignoredEntries: number;
  maxBytes: number;
  status: "ok" | "warn" | "critical";
}

export interface IgnoreRule {
  pattern: string;
  negated: boolean;
}
