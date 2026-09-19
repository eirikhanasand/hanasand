import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import { isDiscordWebhookFileDestination, isDiscordWebhookUrl } from '#utils/alerts/discordWebhookFile.ts'

type AccessInput = { actionType: string, targetUrl: string | null, organizationId: string | null, modelName: string | null, notificationDestinations?: string[] }

export function needsSystemAutomationAccess(input: AccessInput) {
    return input.actionType === 'mail_health_check' || ['system:metrics', 'system:ti-delivery', 'system:ti-collection', 'system:ti-enrichment', 'system:resilience'].includes(input.targetUrl || '')
        || [input.modelName, ...(input.notificationDestinations || [])].some(isDiscordWebhookFileDestination)
}

export async function automationAccessError(input: AccessInput, ownerId: string, systemAdmin: boolean) {
    if (!systemAdmin && needsSystemAutomationAccess(input)) return 'System monitoring and server notification files require administrator access.'
    if (!systemAdmin && [input.modelName, ...(input.notificationDestinations || [])].some(value => value && !isDiscordWebhookUrl(value))) return 'Use a valid Discord webhook URL for your notifications.'
    if (!input.organizationId) return input.actionType === 'organization_report' ? 'Organization reports need an organization.' : null
    const result = await run(`SELECT 1 FROM organizations o WHERE o.id = $1 AND o.status = 'active'
        AND ($3::boolean OR EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = o.id AND m.user_id = $2 AND m.status = 'active' AND m.role IN ('owner', 'admin', 'editor')))`, [input.organizationId, ownerId, systemAdmin])
    return result.rows.length ? null : 'You no longer have access to this organization.'
}

export async function checkScheduledAutomationAccess(input: AccessInput, ownerId: string) {
    if (!input.organizationId && !needsSystemAutomationAccess(input)) return
    const role = await run(await loadSQL('hasRole.sql'), [ownerId, 'system_admin'])
    const error = await automationAccessError(input, ownerId, role.rows[0]?.has_role === true)
    if (error) throw new Error(error)
}

// Aliases and placeholders are fixed by callers, never supplied by a request.
export function automationReadScope(alias: string, admin: string, owner: string, mutate = false) {
    const a = alias ? `${alias}.` : ''
    return `(${admin}::boolean OR (${a}owner_id = ${owner}
        AND ${a}action_type <> 'mail_health_check' AND ${a}target_url IS DISTINCT FROM 'system:resilience' AND ${a}target_url IS DISTINCT FROM 'system:metrics' AND ${a}target_url IS DISTINCT FROM 'system:ti-delivery' AND ${a}target_url IS DISTINCT FROM 'system:ti-collection' AND ${a}target_url IS DISTINCT FROM 'system:ti-enrichment'
        AND COALESCE(${a}model_name, '') NOT LIKE 'discord-webhook-file:%'
        AND NOT EXISTS (SELECT 1 FROM unnest(${a}notification_destinations) destination WHERE destination LIKE 'discord-webhook-file:%')
        AND (${a}organization_id IS NULL OR EXISTS (SELECT 1 FROM organizations o JOIN organization_members m ON m.organization_id = o.id
            WHERE o.id = ${a}organization_id AND o.status = 'active' AND m.user_id = ${owner} AND m.status = 'active' ${mutate ? 'AND m.role IN (\'owner\', \'admin\', \'editor\')' : ''}))))`
}

export function automationWriteScope(alias: string, admin: string, owner: string) {
    return automationReadScope(alias, admin, owner, true)
}
