export interface RuntimeConfig {
  serviceName: "ti-scraper";
  apiVersion: "v1";
  port: number;
  environment: "local" | "development" | "staging" | "production";
  limits: ResourceLimits;
  collection: CollectionDefaults;
  scheduler: SchedulerRuntimeDefaults;
}

export interface ResourceLimits {
  maxRequestTasks: number;
  maxTaskBytes: number;
  maxConcurrentClearWebTasks: number;
  maxConcurrentTelegramTasks: number;
  maxConcurrentDarknetMetadataTasks: number;
  maxMemoryMbTarget: number;
  maxMemoryMbCeiling: number;
}

export interface CollectionDefaults {
  userAgent: string;
  defaultTimeoutMs: number;
  highRiskRequiresApproval: boolean;
  darknetMetadataOnly: boolean;
}

export interface SchedulerRuntimeDefaults {
  queueBackend: "embedded_memory" | "postgres_scheduler_store";
  postgresQueueEnabled: boolean;
  postgresDsnConfigured: boolean;
  postgresShadowWritesEnabled: boolean;
  postgresLeaseMode: "disabled" | "shadow" | "active";
}
