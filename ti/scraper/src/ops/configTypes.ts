export interface ScraperResourceBudget {
  maxRamGb: number;
  normalCeilingGb: number;
  reservedDiskGb: number;
  maxCollectionWorkers: number;
  maxProcessingWorkers: number;
  maxTelegramWorkers: number;
  maxBrowserWorkers: number;
  maxDarknetMetadataWorkers: number;
  maxQueueItems: number;
}

export interface ScraperRuntimeConfig {
  env: "development" | "test" | "production";
  port: number;
  logLevel: "debug" | "info" | "warn" | "error";
  deploymentTarget: "local" | "inspur" | "other";
  browserWorkersEnabled: boolean;
  darknetMetadataWorkersEnabled: boolean;
  metricsEnabled: boolean;
  resourceBudget: ScraperResourceBudget;
}
