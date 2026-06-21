export type RouteOwner = "Agent 01" | "Agent 02" | "Agent 04" | "Agent 05" | "Agent 06" | "Agent 07" | "Agent 08" | "Agent 09" | "Agent 10";

export interface RouteCheck {
  owner: RouteOwner;
  name: string;
  method: "GET" | "POST";
  path: string;
  expectedStatus?: number;
  body?: unknown;
  expectKeys: string[];
  expectText?: string[];
  expectContentType?: string;
}

export interface RouteResult {
  owner: RouteOwner;
  name: string;
  route: string;
  status: number;
  ok: boolean;
  keys: string[];
  expectedOutput: string;
  errorCode?: string;
}
