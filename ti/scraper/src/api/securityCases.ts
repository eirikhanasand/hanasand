import { createHash } from 'node:crypto';
import { authenticateOperatorRequest } from './requestAuthentication.ts';
import { resolveOrganizationScope } from './organizationRoutes.ts';
import { error, json } from './http.ts';
import type { ApiServerOptions } from './serverTypes.ts';
import { redactSecretBearingText } from '../../../../api/src/utils/alerts/discordWebhookFile.ts';

const statuses = { new: 'open', investigating: 'in_progress', benign: 'false_positive', resolved: 'closed', suppressed: 'suppressed' } as const;
const text = (value: unknown, limit: number) => typeof value === 'string' ? redactSecretBearingText(value).slice(0, limit) : '';
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));

// A detection is delivered by the API worker, never by a browser claiming an organization.
export async function receiveSecurityCase(request: Request, options: ApiServerOptions) {
  const auth = await authenticateOperatorRequest(request, options);
  if (auth.error) return auth.error;
  if (!auth.identity?.roles.includes('service')) return error('service_required', 'Security case delivery requires service authentication.', 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return error('invalid_detection', 'A detection is required.', 400);
  const scope = resolveOrganizationScope({ body, request, url: new URL(request.url) }, options);
  if (scope.error) return scope.error;
  if (!scope.organizationId || (scope.organization as any)?.status !== 'active') return error('organization_required', 'An active organization is required.', 400);
  if (typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(body.id)
    || !text(body.summary, 200) || !text(body.ruleId, 200)
    || !['low', 'medium', 'high', 'critical'].includes(body.severity)
    || !Object.hasOwn(statuses, body.status) || !timestamp(body.firstObserved) || !timestamp(body.lastObserved)
    || !Array.isArray(body.events) || body.events.length > 100
    || body.events.some((event: any) => !event || typeof event.id !== 'string' || !timestamp(event.at) || typeof event.message !== 'string' || event.message.length > 20000)) {
    return error('invalid_detection', 'The detection or its events are invalid.', 400);
  }
  const id = `case_${createHash('sha256').update(JSON.stringify(['mill', scope.organizationId, body.id])).digest('hex').slice(0, 32)}`;
  const store = options.store as any;
  const existing = store.getCase(id);
  // Re-delivery must not undo an analyst's decision, assignment, or comments.
  if (existing) return json({ case: { id: existing.id } });
  const status = statuses[body.status as keyof typeof statuses];
  const actor = 'Security monitoring';
  const note = text(body.analystNote, 4000);
  const members = store.listOrganizationMembers?.() ?? [];
  const owner = members.find((member: any) => member.organizationId === scope.organizationId && member.status === 'active' && member.role !== 'viewer' && member.userId === body.assigneeId);
  const workflowEvents = [{ id: `${id}:open`, at: body.firstObserved, actor, action: 'open', toStatus: 'open', note: `Detected by ${text(body.ruleId, 200)}.
${text(body.evidence, 20000)}` },
    ...body.events.map((event: any) => ({ id: `${id}:log:${event.id}`, at: event.at, actor: text(event.source, 200) || actor, action: 'log', note: text(event.message, 20000) }))];
  if (status !== 'open' || note || owner) workflowEvents.push({ id: `${id}:migrated`, at: body.lastObserved, actor, action: 'migrated', toStatus: status, toOwner: owner?.userId, note: note || 'Previous investigation status preserved.' } as any);
  const saved = store.saveCase({ id, tenantId: scope.tenantId, organizationId: scope.organizationId,
    sourceType: 'security_detection', sourceId: body.id, title: text(body.summary, 200), summary: text(body.summary, 5000),
    priority: body.severity, status, assignedOwner: owner?.userId,
    createdAt: body.firstObserved, updatedAt: body.lastObserved, workflowEvents,
    ...(status === 'closed' ? { closedAt: body.lastObserved, resolution: { id: `${id}:resolution`, type: 'unknown', at: body.lastObserved, note: note || 'Closed in the previous findings workflow.' } } : {}) });
  return json({ case: { id: saved.id } }, 201);
}
