import { error } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export type AuthenticatedIdentity = {
  id: string;
  roles: string[];
};

export async function authenticateRequest(request: Request, options: ApiServerOptions): Promise<{ identity?: AuthenticatedIdentity; error?: Response }> {
  const authorization = request.headers.get("authorization") ?? "";
  const id = request.headers.get("id")?.trim() ?? "";
  if (!id || !/^[A-Za-z0-9_.:@-]{1,200}$/.test(id) || !authorization.startsWith("Bearer ") || authorization.length > 4096) {
    return { error: error("authentication_required", "A valid Hanasand session is required", 401) };
  }

  const base = String(options.authApiBase ?? Bun.env.HANASAND_AUTH_API_BASE ?? "").trim();
  if (!base) return { error: error("authentication_unavailable", "Session validation is not configured", 503) };

  let endpoint: URL;
  try {
    const baseUrl = new URL(base.endsWith("/") ? base : `${base}/`);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) throw new Error("unsupported auth endpoint");
    endpoint = new URL(`auth/token/${encodeURIComponent(id)}`, baseUrl);
  } catch {
    return { error: error("authentication_unavailable", "Session validation is misconfigured", 503) };
  }

  const fetcher = typeof options.authFetch === "function" ? options.authFetch as typeof fetch : fetch;
  try {
    const response = await fetcher(endpoint, {
      headers: { authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status === 401 || response.status === 403) return { error: error("invalid_session", "The Hanasand session is invalid or expired", 401) };
    if (!response.ok) return { error: error("authentication_unavailable", "Session validation is unavailable", 503) };
    const payload: any = await response.json().catch(() => undefined);
    if (!payload || String(payload.id ?? "") !== id) return { error: error("invalid_session", "The Hanasand session is invalid or expired", 401) };
    const roles: string[] = [];
    for (const role of Array.isArray(payload.roles) ? payload.roles : []) {
      const value = String(role?.id ?? role?.role_id ?? role?.role ?? role ?? "").trim();
      if (value) roles.push(value);
    }
    return { identity: { id, roles: [...new Set(roles)] } };
  } catch {
    return { error: error("authentication_unavailable", "Session validation is unavailable", 503) };
  }
}
