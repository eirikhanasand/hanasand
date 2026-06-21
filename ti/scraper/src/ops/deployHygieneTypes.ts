export interface DeployHygieneCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface DeployHygieneReport {
  ok: boolean;
  repoRoot: string;
  checks: DeployHygieneCheck[];
}
