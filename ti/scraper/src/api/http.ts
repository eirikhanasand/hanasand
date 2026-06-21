export function page<T>(items: T[], url: URL): T[] {
  const limit = numberQuery(url.searchParams.get("limit")) ?? 50;
  return items.slice(0, Math.max(1, Math.min(500, limit)));
}

export function numberQuery(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function booleanQuery(value: string | null): boolean | null {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

export async function readJson<T = any>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export function error(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}
