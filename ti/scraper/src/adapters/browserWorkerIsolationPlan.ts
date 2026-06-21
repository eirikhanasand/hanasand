export interface BrowserWorkerIsolationPlan {
  enabled: false;
  workerPool: "dynamic_public_browser";
  networkIsolation: {
    publicOnly: true;
    hostAllowlist: string[];
    blockPrivateNetworks: true;
    blockCredentials: true;
    blockCaptchaSolving: true;
    blockDownloads: true;
  };
  resourceCaps: {
    maxWorkers: number;
    memoryCapMb: number;
    timeoutMs: number;
  };
  policy: {
    robotsAllowed: boolean;
    legalNotesPresent: boolean;
  };
}
