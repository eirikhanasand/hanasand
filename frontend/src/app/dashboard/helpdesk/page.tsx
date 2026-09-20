import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import config from '@/config'
import AuditTimeline from './auditTimeline'
import { buildApiQuery, helpdeskEvent, type AdminAuditEvent, type AuditSearchParams } from './audit'

function decodeAccessToken(value: string) {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

export default async function HelpdeskPage({
    searchParams,
}: {
    searchParams: Promise<AuditSearchParams>
}) {
    const Cookies = await cookies()
    const params = await searchParams
    const id = Cookies.get('id')?.value || ''
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/helpdesk%26expired=true')
    }

    const query = buildApiQuery(params)
    const response = await fetch(`${config.url.api}/system/events${query ? `?${query}` : ''}`, {
        headers: {
            Authorization: `Bearer ${decodeAccessToken(token)}`,
            id,
        },
        cache: 'no-store',
    }).catch(() => null)
    const payload = response?.ok ? await response.json().catch(() => null) : null
    const events = Array.isArray(payload?.events) ? payload.events as AdminAuditEvent[] : []
    const responseError = response && !response.ok
        ? `Audit service reported ${response.status}.`
        : !response
            ? 'Audit API is unavailable.'
            : ''

    return <AuditTimeline events={events.map(helpdeskEvent)} params={params} responseError={responseError} />
}
