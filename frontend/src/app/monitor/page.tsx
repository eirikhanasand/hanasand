import type { Metadata } from 'next'
import { getTrafficMetrics } from '@/utils/monitoring/data'
import getMetrics from '@/utils/traffic/getMetrics'
import { domainCaptures, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'
import { buildRouteMetadata } from '../seo'
import MonitorClient, { type MonitorRow } from './monitorClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Monitor',
    description: 'Filter monitored customer domains by customer, name, monitoring age, and breach mentions.',
    path: '/monitor',
    keywords: ['hanasand monitor', 'monitored domains', 'customer breach monitoring'],
})

export default async function MonitorPage() {
    const [trafficMetrics, domainTraffic, ti] = await Promise.all([
        getTrafficMetrics(),
        getMetrics('domain'),
        getTiAdminOverview(),
    ])
    const tiByDomain = new Map(ti.domains.map(domain => [domain.domain, domain]))
    const trafficRows = Array.isArray(domainTraffic) ? domainTraffic : []
    const topDomains = typeof trafficMetrics === 'string' ? [] : trafficMetrics.top_domains
    const domains = new Set([...topDomains.map(domain => domain.key), ...trafficRows.map(row => row.value), ...ti.domains.map(domain => domain.domain)].filter(isMonitorDomain))

    const rows: MonitorRow[] = [...domains].filter(Boolean).map(domain => {
        const tiDomain = tiByDomain.get(domain)
        const traffic = trafficRows.find(row => row.value === domain)
        const captures = domainCaptures(ti, domain)
        const sources = (tiDomain?.sourceIds || []).map(id => sourceById(ti, id)?.name).filter((name): name is string => Boolean(name))

        return {
            domain,
            customer: tiDomain?.company || customerFromDomain(domain),
            status: tiDomain?.status || 'watching',
            monitoredSince: captures[0]?.monitoredSince || ti.sources.find(source => source.domains.includes(domain))?.monitoredSince || '',
            lastSeenAt: tiDomain?.lastSeenAt || '',
            breachMentions: tiDomain?.resultCount || captures.length,
            matchedTerms: tiDomain?.matchedTerms || [domain],
            sources,
            requestsToday: traffic?.hits_today || 0,
            requestsThisWeek: traffic?.hits_last_week || 0,
            requestsThisMonth: traffic?.hits_this_month || 0,
            requestsTotal: traffic?.hits_total || topDomains.find(item => item.key === domain)?.count || 0,
        }
    })

    return <MonitorClient initialRows={rows} />
}

function customerFromDomain(domain: string) {
    return domain.replace(/^www\./, '').split('.')[0]?.replaceAll('-', ' ') || domain
}

function isMonitorDomain(value: string) {
    return Boolean(value && !value.startsWith('/') && !value.includes(' ') && (value.includes('.') || value === 'localhost') && !/^[\d.]+$/.test(value))
}
