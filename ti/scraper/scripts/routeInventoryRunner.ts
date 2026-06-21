import type { RouteCheck, RouteResult } from "./routeInventoryTypes.ts";

export async function runRouteCheck(base: string, check: RouteCheck): Promise<RouteResult> {
  const response = await fetch(`${base}${check.path}`, {
    method: check.method,
    headers: check.body ? { "content-type": "application/json" } : undefined,
    body: check.body ? JSON.stringify(check.body) : undefined
  });
  const text = await response.text();
  const json = parseJson(text);
  const keys = isRecord(json) ? Object.keys(json).sort() : [];
  const missingKeys = check.expectKeys.filter((key) => !keys.includes(key));
  const missingText = (check.expectText ?? []).filter((value) => !text.includes(value));
  const contentTypeOk = check.expectContentType ? (response.headers.get("content-type") ?? "").includes(check.expectContentType) : true;
  const expectedStatus = check.expectedStatus ?? 200;
  const unsafeLeak = ["telegram raw proof payload", "cookie=", "password=", "authorization:", "set-cookie"].some((raw) => text.toLowerCase().includes(raw));
  return {
    owner: check.owner,
    name: check.name,
    route: `${check.method} ${check.path.split("?")[0]}`,
    status: response.status,
    ok: response.status === expectedStatus && missingKeys.length === 0 && missingText.length === 0 && contentTypeOk && !unsafeLeak,
    keys,
    expectedOutput: check.expectText?.length ? `HTTP ${expectedStatus}; text=${check.expectText.join(",")}; compact safe response` : `HTTP ${expectedStatus}; keys=${check.expectKeys.join(",")}; compact safe response`,
    errorCode: errorCode(response.status, expectedStatus, missingKeys, missingText, contentTypeOk, json)
  };
}

function errorCode(status: number, expectedStatus: number, missingKeys: string[], missingText: string[], contentTypeOk: boolean, json: unknown): string | undefined {
  if (status !== expectedStatus) return `status_${status}`;
  if (missingKeys.length) return `missing_${missingKeys.join("_")}`;
  if (missingText.length) return `missing_text_${missingText.join("_")}`;
  if (!contentTypeOk) return "content_type_mismatch";
  return isRecord(json) && isRecord(json.error) ? String(json.error.code ?? "") : undefined;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
