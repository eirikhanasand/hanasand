import { error } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { timingSafeEqual } from "node:crypto";

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

export async function authenticateOperatorRequest(request: Request, options: ApiServerOptions): Promise<{ identity?: AuthenticatedIdentity; error?: Response }> {
  const serviceToken = String(options.serviceToken ?? Bun.env.TI_SCRAPER_SERVICE_TOKEN ?? "").trim();
  const authApiBase = String(options.authApiBase ?? Bun.env.HANASAND_AUTH_API_BASE ?? "").trim();
  if (!serviceToken && !authApiBase) return {};

  const presented = request.headers.get("x-hanasand-service-token") ?? "";
  if (serviceToken && sameSecret(presented, serviceToken)) {
    return { identity: { id: "service:hanasand-api", roles: ["service"] } };
  }
  return authenticateRequest(request, options);
}

export function authorizeOperatorScope(identity: AuthenticatedIdentity, options: ApiServerOptions, tenantId?: string): Response | undefined {
  if (identity.roles.some((role) => ["service", "system_admin"].includes(role))) return undefined;
  const sourceOperator = identity.roles.some((role) => ["source_admin", "source_operator"].includes(role));
  if (tenantId === undefined || tenantId === "default") {
    return sourceOperator ? undefined : error("source_operator_forbidden", "Global and default source operations require a source operator role", 403);
  }
  if (!sourceOperator && !identity.roles.some((role) => ["owner", "admin", "administrator"].includes(role))) {
    return error("source_operator_forbidden", "Source operations require an operator or administrator role", 403);
  }
  const organization = ((options.store as any).listOrganizations?.() ?? []).find((row: any) => row.tenantId === tenantId && row.status === "active");
  const member = organization && ((options.store as any).listOrganizationMembers?.() ?? []).find((row: any) =>
    row.organizationId === organization.id
    && row.status === "active"
    && ["owner", "admin"].includes(row.role)
    && [row.id, row.userId, row.email].some((value) => String(value ?? "").trim().toLowerCase() === identity.id.trim().toLowerCase()));
  return member ? undefined : error("tenant_operator_access_denied", "Source operations require administrator membership in the exact tenant", 403);
}

function sameSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}
