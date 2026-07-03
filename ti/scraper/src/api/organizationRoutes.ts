import { nowIso, stableId, uniqueStrings } from "../utils.ts";
import { sanitizeDwmCustomerEvidenceExcerpt, sanitizeDwmCustomerText } from "../product/dwmCustomerDisplay.ts";
import { json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

type OrganizationRole = "owner" | "admin" | "analyst" | "viewer";
type OrganizationStatus = "active" | "suspended";
type MemberStatus = "active" | "invited" | "removed";
type InviteStatus = "pending" | "accepted" | "revoked" | "expired";
type WebhookKind = "discord" | "generic";

export type Organization = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type OrganizationMember = {
  id: string;
  organizationId: string;
  email: string;
  userId?: string;
  role: OrganizationRole;
  status: MemberStatus;
  invitedAt?: string;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationInvite = {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  status: InviteStatus;
  invitedBy?: string;
  invitedAt: string;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  tokenPreview: string;
  createdAt: string;
  updatedAt: string;
};

export type WebhookDestination = {
  id: string;
  organizationId: string;
  tenantId: string;
  name: string;
  url: string;
  kind: WebhookKind;
  status: "active" | "paused";
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  lastTestedAt?: string;
  lastTestStatus?: "delivered" | "failed" | "dry_run";
};

type PublicWebhookDestination = Omit<WebhookDestination, "url"> & {
  endpointHash: string;
  endpointHint: string;
};

export function listOrganizations(_url: URL, options: ApiServerOptions): Response {
  const organizations = (options.store as any).listOrganizations?.() ?? [];
  return json({ organizations });
}

export async function createOrganization(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const name = String(body.name ?? "").trim();
  if (!name) return json({ error: { code: "missing_name", message: "Organization name is required." } }, 400);

  const generatedAt = nowIso();
  const slug = normalizeSlug(body.slug ?? name);
  const id = String(body.id ?? stableId("org", slug));
  const existing = (options.store as any).getOrganization?.(id);
  const organization: Organization = {
    id,
    tenantId: existing?.tenantId ?? id,
    name,
    slug,
    status: body.status === "suspended" ? "suspended" : "active",
    createdAt: existing?.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    createdBy: String(body.createdBy ?? request.headers.get("x-actor-id") ?? "").trim() || existing?.createdBy
  };

  (options.store as any).saveOrganization(organization);
  const ownerEmail = normalizeEmail(body.ownerEmail ?? body.email ?? request.headers.get("x-user-email"));
  const owner = ownerEmail ? upsertMember(options, {
    organizationId: organization.id,
    email: ownerEmail,
    userId: body.ownerUserId ? String(body.ownerUserId) : undefined,
    role: "owner",
    status: "active",
    acceptedAt: generatedAt,
    generatedAt
  }) : undefined;

  return json({ organization, owner }, existing ? 200 : 201);
}

export function listOrganizationMembers(_url: URL, options: ApiServerOptions, organizationId: string | undefined): Response {
  const organization = findOrganization(options, organizationId);
  if (!organization) return orgNotFound();
  const members = ((options.store as any).listOrganizationMembers?.() ?? []).filter((row: OrganizationMember) => row.organizationId === organization.id);
  const invites = ((options.store as any).listOrganizationInvites?.() ?? []).filter((row: OrganizationInvite) => row.organizationId === organization.id && row.status === "pending");
  return json({ organization, members, pendingInvites: invites });
}

export async function createOrganizationInvites(request: Request, options: ApiServerOptions, organizationId: string | undefined): Promise<Response> {
  const organization = findOrganization(options, organizationId);
  if (!organization) return orgNotFound();
  const body = await readJson<any>(request);
  const emails = uniqueStrings([
    ...toEmailList(body.email),
    ...toEmailList(body.emails)
  ].map(normalizeEmail).filter(Boolean) as string[]);
  if (!emails.length) return json({ error: { code: "missing_email", message: "Invite at least one valid email address." } }, 400);
  if (emails.length > 50) return json({ error: { code: "too_many_invites", message: "Invite at most 50 users at a time." } }, 400);

  const role = normalizeRole(body.role);
  const generatedAt = nowIso();
  const invitedBy = String(body.invitedBy ?? request.headers.get("x-actor-id") ?? "").trim() || undefined;
  const expiresAt = new Date(Date.parse(generatedAt) + 1000 * 60 * 60 * 24 * Number(body.expiresInDays ?? 14)).toISOString();

  const invites = emails.map((email) => {
    const invite: OrganizationInvite = {
      id: stableId("org_invite", `${organization.id}:${email}:${role}`),
      organizationId: organization.id,
      email,
      role,
      status: "pending",
      invitedBy,
      invitedAt: generatedAt,
      expiresAt,
      tokenPreview: stableId("invite_token", `${organization.id}:${email}:${generatedAt}`).slice(-10),
      createdAt: generatedAt,
      updatedAt: generatedAt
    };
    (options.store as any).saveOrganizationInvite(invite);
    upsertMember(options, { organizationId: organization.id, email, role, status: "invited", invitedAt: generatedAt, generatedAt });
    return invite;
  });

  const members = ((options.store as any).listOrganizationMembers?.() ?? []).filter((row: OrganizationMember) => row.organizationId === organization.id);
  return json({ organization, invites, members }, 201);
}

export function listWebhookDestinations(_url: URL, options: ApiServerOptions, organizationId: string | undefined): Response {
  const organization = findOrganization(options, organizationId);
  if (!organization) return orgNotFound();
  const destinations = organizationWebhookDestinationRows(options, organization.id).map(publicWebhookDestination);
  return json({ organization, destinations });
}

export async function createWebhookDestination(request: Request, options: ApiServerOptions, organizationId: string | undefined): Promise<Response> {
  const organization = findOrganization(options, organizationId);
  if (!organization) return orgNotFound();
  const body = await readJson<any>(request);
  const url = normalizeWebhookUrl(body.url ?? body.webhookUrl);
  if (!url) return json({ error: { code: "invalid_webhook_url", message: "Webhook URL must start with http:// or https://." } }, 400);

  const generatedAt = nowIso();
  const kind = body.kind === "discord" || body.kind === "generic" ? body.kind : inferWebhookKind(url);
  const destination: WebhookDestination = {
    id: String(body.id ?? stableId("webhook_destination", `${organization.id}:${url}`)),
    organizationId: organization.id,
    tenantId: organization.tenantId,
    name: String(body.name ?? (kind === "discord" ? "Discord alerts" : "Webhook alerts")).trim(),
    url,
    kind,
    status: body.status === "paused" ? "paused" : "active",
    createdAt: (options.store as any).getWebhookDestination?.(String(body.id ?? stableId("webhook_destination", `${organization.id}:${url}`)))?.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    createdBy: String(body.createdBy ?? request.headers.get("x-actor-id") ?? "").trim() || undefined
  };
  (options.store as any).saveWebhookDestination(destination);
  return json({ organization, destination: publicWebhookDestination(destination) }, 201);
}

export async function updateWebhookDestination(request: Request, options: ApiServerOptions, organizationId: string | undefined, destinationId: string | undefined): Promise<Response> {
  const organization = findOrganization(options, organizationId);
  if (!organization) return orgNotFound();
  const existing = findOrganizationWebhookDestination(options, organization.id, destinationId);
  if (!existing) return webhookDestinationNotFound();

  const body = await readJson<any>(request);
  const nextUrl = body.url !== undefined || body.webhookUrl !== undefined
    ? normalizeWebhookUrl(body.url ?? body.webhookUrl)
    : existing.url;
  if (!nextUrl) return json({ error: { code: "invalid_webhook_url", message: "Webhook URL must start with http:// or https://." } }, 400);

  const generatedAt = nowIso();
  const kind = body.kind === "discord" || body.kind === "generic" ? body.kind : inferWebhookKind(nextUrl);
  const status = body.status === "paused" ? "paused" : body.status === "active" ? "active" : existing.status;
  const destination: WebhookDestination = {
    ...existing,
    name: body.name !== undefined ? String(body.name || existing.name).trim() || existing.name : existing.name,
    url: nextUrl,
    kind,
    status,
    updatedAt: generatedAt
  };
  (options.store as any).saveWebhookDestination(destination);
  return json({ organization, destination: publicWebhookDestination(destination) });
}

export async function disableWebhookDestination(_request: Request, options: ApiServerOptions, organizationId: string | undefined, destinationId: string | undefined): Promise<Response> {
  const organization = findOrganization(options, organizationId);
  if (!organization) return orgNotFound();
  const existing = findOrganizationWebhookDestination(options, organization.id, destinationId);
  if (!existing) return webhookDestinationNotFound();
  const generatedAt = nowIso();
  const destination = (options.store as any).saveWebhookDestination({ ...existing, status: "paused", updatedAt: generatedAt });
  return json({ organization, destination: publicWebhookDestination(destination) });
}

export async function testOrganizationWebhook(request: Request, options: ApiServerOptions, organizationId: string | undefined): Promise<Response> {
  const organization = findOrganization(options, organizationId);
  if (!organization) return orgNotFound();
  const body = await readJson<any>(request);
  const destinations = organizationWebhookDestinations(options, organization.id);
  const destination = body.webhookDestinationId
    ? destinations.find((row) => row.id === body.webhookDestinationId)
    : destinations.find((row) => row.status === "active");
  if (!destination) return json({ error: { code: "missing_webhook_destination", message: "Create an active organization webhook destination before testing delivery." } }, 400);

  const generatedAt = nowIso();
  const deliveryId = stableId("org_webhook_delivery", `${organization.id}:${destination.id}:${generatedAt}`);
  const payload = buildWebhookRequestBody(destination.kind, {
    eventType: "organization.webhook.test",
    organizationId: organization.id,
    tenantId: organization.tenantId,
    webhookDestinationId: destination.id,
    generatedAt,
    message: "Hanasand organization webhook test.",
    expectedAlertEvent: "darkweb.monitoring.match"
  });

  const baseDelivery = {
    id: deliveryId,
    organizationId: organization.id,
    tenantId: organization.tenantId,
    alertId: "organization_webhook_test",
    watchlistId: "organization_webhook_test",
    webhookDestinationId: destination.id,
    endpointHash: stableId("endpoint", destination.url),
    dedupeKey: deliveryId,
    attemptedAt: generatedAt,
    dryRun: body.dryRun === true,
    payloadHash: stableId("payload", JSON.stringify(payload)),
    deliveryKind: destination.kind
  };

  if (body.dryRun === true) {
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "dry_run", httpStatus: 0 });
    (options.store as any).saveWebhookDestination({ ...destination, lastTestedAt: generatedAt, lastTestStatus: "dry_run", updatedAt: generatedAt });
    return json({ testedAt: generatedAt, ok: true, dryRun: true, delivery });
  }

  const fetcher = typeof options.webhookFetch === "function" ? options.webhookFetch as typeof fetch : fetch;
  try {
    const response = await fetcher(destination.url, {
      method: "POST",
      headers: webhookHeaders("organization.webhook.test", deliveryId, deliveryId),
      body: JSON.stringify(payload)
    });
    const ok = response.status >= 200 && response.status < 300;
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: ok ? "delivered" : "failed", httpStatus: response.status });
    (options.store as any).saveWebhookDestination({ ...destination, lastTestedAt: generatedAt, lastTestStatus: ok ? "delivered" : "failed", updatedAt: generatedAt });
    return json({ testedAt: generatedAt, ok, delivery }, ok ? 200 : 502);
  } catch (error) {
    const delivery = (options.store as any).saveDwmWebhookDelivery({ ...baseDelivery, status: "failed", httpStatus: 0, error: error instanceof Error ? error.message : String(error) });
    (options.store as any).saveWebhookDestination({ ...destination, lastTestedAt: generatedAt, lastTestStatus: "failed", updatedAt: generatedAt });
    return json({ testedAt: generatedAt, ok: false, delivery }, 502);
  }
}

export function resolveOrganizationScope(input: { body?: any; url?: URL; request?: Request }, options: ApiServerOptions): { organization?: Organization; organizationId?: string; tenantId: string; error?: Response } {
  const organizationId = String(input.body?.organizationId ?? input.url?.searchParams.get("organizationId") ?? input.request?.headers.get("x-organization-id") ?? "").trim();
  if (organizationId) {
    const organization = findOrganization(options, organizationId);
    if (!organization) return { organizationId, tenantId: organizationId, error: orgNotFound() };
    return { organization, organizationId: organization.id, tenantId: organization.tenantId };
  }
  return { tenantId: String(input.body?.tenantId ?? input.url?.searchParams.get("tenantId") ?? input.request?.headers.get("x-tenant-id") ?? "default") };
}

export function organizationWebhookDestinations(options: ApiServerOptions, organizationId: string | undefined): WebhookDestination[] {
  if (!organizationId) return [];
  return organizationWebhookDestinationRows(options, organizationId)
    .filter((row: WebhookDestination) => row.organizationId === organizationId && row.status === "active");
}

export function findWebhookDestination(options: ApiServerOptions, id: string | undefined): WebhookDestination | undefined {
  if (!id) return undefined;
  return (options.store as any).getWebhookDestination?.(id) ?? ((options.store as any).listWebhookDestinations?.() ?? []).find((row: WebhookDestination) => row.id === id);
}

function organizationWebhookDestinationRows(options: ApiServerOptions, organizationId: string | undefined): WebhookDestination[] {
  if (!organizationId) return [];
  return ((options.store as any).listWebhookDestinations?.() ?? [])
    .filter((row: WebhookDestination) => row.organizationId === organizationId);
}

function findOrganizationWebhookDestination(options: ApiServerOptions, organizationId: string, destinationId: string | undefined): WebhookDestination | undefined {
  const destination = findWebhookDestination(options, destinationId);
  return destination?.organizationId === organizationId ? destination : undefined;
}

function publicWebhookDestination(destination: WebhookDestination): PublicWebhookDestination {
  const { url: _url, ...safeDestination } = destination;
  return {
    ...safeDestination,
    endpointHash: stableId("endpoint", destination.url),
    endpointHint: redactWebhookUrl(destination.url)
  };
}

export function inferWebhookKind(url: string): WebhookKind {
  const lower = url.toLowerCase();
  return lower.includes("discord.com/api/webhooks") || lower.includes("discordapp.com/api/webhooks") ? "discord" : "generic";
}

export function buildWebhookRequestBody(kind: WebhookKind, payload: any): any {
  if (kind !== "discord") return payload;
  const isAlert = payload.eventType === "darkweb.monitoring.match";
  const evidenceCount = Number(payload.evidenceCount ?? payload.evidenceSummary?.evidenceCount ?? payload.evidence?.length ?? 0);
  const evidenceTimestamp = payload.evidenceSummary?.lastObservedAt
    ?? payload.generationEvidenceWindow?.lastObservedAt
    ?? payload.evidence?.[0]?.observedAt
    ?? payload.lastSeenAt
    ?? payload.firstSeenAt
    ?? payload.generatedAt;
  const route = payload.recommendedRoute ?? payload.routingContext?.queue ?? payload.workflowStatus;
  const caseLink = payload.casePath ?? payload.alertDetailPath;
  const notificationTarget = payload.notificationTarget ?? {};
  const targetLabel = notificationTarget.organizationId || payload.organizationId || payload.tenantId;
  const ownerLabel = notificationTarget.assignedOwner || payload.assignedOwner;
  const title = payload.eventType === "darkweb.monitoring.match"
    ? `${payload.severity?.toUpperCase?.() ?? "ALERT"}: ${payload.company ?? payload.matchedTerm ?? "watchlist match"}`
    : "Hanasand webhook test";
  return {
    content: isAlert
      ? `Hanasand alert for ${payload.company ?? payload.matchedTerm ?? "watchlist match"}${targetLabel ? ` in ${targetLabel}` : ""}`
      : "Hanasand organization webhook test.",
    embeds: [{
      title,
      description: sanitizeDwmCustomerText(payload.claimSummary, payload.message ?? "Webhook route is configured."),
      timestamp: evidenceTimestamp,
      color: payload.severity === "critical" ? 13_938_440 : payload.severity === "high" ? 15_813_888 : 3_168_467,
      fields: [
        field("Organization", payload.organizationId ?? payload.tenantId),
        field("Matched term", payload.matchedTerm),
        field("Actor", payload.actor),
        field("Source family", payload.sourceFamily),
        field("Evidence", evidenceCount ? `${evidenceCount} item${evidenceCount === 1 ? "" : "s"}; latest ${evidenceTimestamp}` : undefined),
        field("Evidence excerpt", discordEvidenceExcerpt(payload)),
        field("Confidence", typeof payload.confidence === "number" ? `${payload.confidence}%${firstString(payload.confidenceReasoning) ? ` - ${firstString(payload.confidenceReasoning)}` : ""}` : undefined),
        field("Notification target", targetLabel ? `${targetLabel}${ownerLabel ? `; owner ${ownerLabel}` : ""}` : undefined),
        field("Case", caseLink),
        field("Route", route),
        field("Review state", payload.reviewState),
        field("Replay", payload.replayMarker ?? payload.deliveryReadinessContext?.replayMarker),
        field("Recommended action", payload.recommendedAction)
      ].filter(Boolean)
    }],
    allowed_mentions: { parse: [] },
    hanasand: payload
  };
}

export function webhookHeaders(eventType: string, deliveryId: string, dedupeKey: string): HeadersInit {
  return {
    "content-type": "application/json",
    "x-hanasand-event": eventType,
    "x-hanasand-delivery-id": deliveryId,
    "x-hanasand-dedupe-key": dedupeKey
  };
}

function upsertMember(options: ApiServerOptions, input: { organizationId: string; email: string; userId?: string; role: OrganizationRole; status: MemberStatus; invitedAt?: string; acceptedAt?: string; generatedAt: string }): OrganizationMember {
  const existing = ((options.store as any).listOrganizationMembers?.() ?? []).find((row: OrganizationMember) => row.organizationId === input.organizationId && row.email === input.email);
  const member: OrganizationMember = {
    id: existing?.id ?? stableId("org_member", `${input.organizationId}:${input.email}`),
    organizationId: input.organizationId,
    email: input.email,
    userId: input.userId ?? existing?.userId,
    role: input.role,
    status: input.status,
    invitedAt: input.invitedAt ?? existing?.invitedAt,
    acceptedAt: input.acceptedAt ?? existing?.acceptedAt,
    createdAt: existing?.createdAt ?? input.generatedAt,
    updatedAt: input.generatedAt
  };
  return (options.store as any).saveOrganizationMember(member);
}

function findOrganization(options: ApiServerOptions, organizationId: string | undefined): Organization | undefined {
  if (!organizationId) return undefined;
  return (options.store as any).getOrganization?.(organizationId) ?? ((options.store as any).listOrganizations?.() ?? []).find((row: Organization) => row.id === organizationId);
}

function orgNotFound(): Response {
  return json({ error: { code: "organization_not_found", message: "Organization not found." } }, 404);
}

function webhookDestinationNotFound(): Response {
  return json({ error: { code: "webhook_destination_not_found", message: "Webhook destination not found." } }, 404);
}

function normalizeSlug(value: unknown): string {
  const slug = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "organization";
}

function normalizeEmail(value: unknown): string | undefined {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined;
}

function toEmailList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  return String(value ?? "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeRole(value: unknown): OrganizationRole {
  return value === "owner" || value === "admin" || value === "viewer" ? value : "analyst";
}

function normalizeWebhookUrl(value: unknown): string | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function redactWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const visiblePath = parts.length ? `/${parts.slice(0, Math.min(parts.length, 3)).join("/")}` : "";
    return `${url.origin}${visiblePath}/...`;
  } catch {
    return "redacted_webhook_endpoint";
  }
}

function field(name: string, value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  return { name, value: String(value).slice(0, 1024), inline: true };
}

function discordEvidenceExcerpt(payload: any): string | undefined {
  const evidence = Array.isArray(payload.evidence) ? payload.evidence : [];
  const first = evidence.find((item: any) => typeof item?.excerpt === "string" && item.excerpt.trim())
    ?? evidence.find((item: any) => typeof item?.contentHash === "string" && item.contentHash.trim());
  if (!first) return undefined;
  const source = first.sourceName || first.sourceFamily || "Evidence";
  const excerpt = sanitizeDwmCustomerEvidenceExcerpt(first.excerpt, first.contentHash);
  return excerpt ? `${source}: ${excerpt}` : undefined;
}

function firstString(value: unknown): string | undefined {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).find(Boolean);
  const text = String(value ?? "").trim();
  return text || undefined;
}
