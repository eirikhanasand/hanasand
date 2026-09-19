import { cookies } from 'next/headers'
import config from '@/config'
import AuditTimeline from './timeline'
import { auditQuery, readAuditPage, type AuditPage, type AuditSearchParams } from './data'
export const dynamic = 'force-dynamic'
export default async function AuditLogPage({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
    const filters = { ...await searchParams }
    delete filters.page
    const audit = await getAuditPage(filters)
    return <AuditTimeline key={JSON.stringify(filters)} initialAudit={audit} filters={filters} />
}

async function getAuditPage(params: AuditSearchParams): Promise<AuditPage> {
    const unavailable: AuditPage = { events: [], available: false, nextCursor: null, total: null }
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) return unavailable
    try {
        const response = await fetch(`${config.url.api}/system/events?${auditQuery(params)}`, {
            headers: { Authorization: `Bearer ${decodeURIComponent(token)}`, id },
            cache: 'no-store',
        })
        const payload = await response.json()
        if (!response.ok) return { ...unavailable, error: typeof payload.error === 'string' ? payload.error : 'Unable to load audit events.' }
        return readAuditPage(payload)
    } catch { return unavailable }
}
