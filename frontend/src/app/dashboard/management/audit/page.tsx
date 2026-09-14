import { cookies } from 'next/headers'
import config from '@/config'
import AuditTimeline from './timeline'
import type { AuditPage, AuditSearchParams } from './data'
export const dynamic = 'force-dynamic'
export default async function AuditLogPage({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
    const filters = { ...await searchParams }
    delete filters.page
    const audit = await getAuditPage(filters)
    return <AuditTimeline key={JSON.stringify(filters)} initialAudit={audit} filters={filters} />
}

async function getAuditPage(params: AuditSearchParams): Promise<AuditPage> {
    const query = new URLSearchParams({ limit: '50' })
    for (const key of ['service', 'actor', 'action', 'target', 'outcome', 'from', 'to']) {
        const value = param(params, key)
        if (value) query.set(key, value)
    }
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) return { events: [], available: false, nextCursor: null, total: null }
    const response = await fetch(`${config.url.api}/system/events?${query.toString()}`, {
        headers: { Authorization: `Bearer ${decodeURIComponent(token)}`, id },
        cache: 'no-store',
    }).catch(() => null)
    if (!response?.ok) return { events: [], available: false, nextCursor: null, total: null }
    const payload = await response.json().catch(() => null) as { events?: Array<Record<string, unknown>>, pagination?: { nextCursor?: string | null, total?: number } } | null
    const events = Array.isArray(payload?.events) ? payload.events.map(event => ({
        id: Number(event.id),
        happenedAt: String(event.created_at || ''),
        actor: String(event.actor_name || event.actor_id || 'system'),
        service: String(event.service || event.source || '—'),
        action: String(event.event_type || ''),
        target: String(event.target_name || event.object_id || event.object_type || '—'),
        result: String(event.outcome || ''),
        detail: String(event.reason || event.service || ''),
    })) : []
    return { events, available: true, nextCursor: payload?.pagination?.nextCursor || null, total: payload?.pagination?.total ?? null }
}

function param(params: AuditSearchParams, key: string) {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value || '').trim()
}

