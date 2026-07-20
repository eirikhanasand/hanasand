import { error } from "./http.ts";

export type TenantScope = { tenantId?: string; error?: Response };

export function resolveTenantScope(request: Request, url = new URL(request.url), bodyTenantId?: unknown): TenantScope {
  const values = [request.headers.get("x-tenant-id"), url.searchParams.get("tenantId"), bodyTenantId]
    .map((value) => typeof value === "string" ? value.trim() : "")
    .filter(Boolean);
  if (new Set(values).size > 1) return { error: error("tenant_scope_mismatch", "Tenant header, query, and body scope must match", 403) };
  const tenantId = values[0];
  if (tenantId && !/^[A-Za-z0-9_.:-]{1,200}$/.test(tenantId)) {
    return { error: error("invalid_tenant_scope", "Tenant scope uses an unsupported format", 400) };
  }
  return { tenantId };
}

export function inTenantScope(record: any, tenantId?: string): boolean {
  return Boolean(record) && (record.tenantId || undefined) === tenantId;
}
