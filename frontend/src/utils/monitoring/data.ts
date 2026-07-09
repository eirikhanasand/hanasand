'use server'

import type {
    GetVulnerabilities,
    MonitoringOverview,
    TrafficDomains,
    TrafficMetrics,
    TrafficRecords,
} from './types'
import { requestService } from './serviceApi'
import getMetrics from '@/utils/traffic/getMetrics'

export async function getVulnerabilities() {
    return await requestService<GetVulnerabilities>('internal', 'vulnerabilities')
}

export async function triggerVulnerabilityScan() {
    return await requestService<{ message: string, status: GetVulnerabilities['scanStatus'] }>(
        'internal',
        'vulnerabilities/scan',
        { method: 'POST', body: JSON.stringify({}) }
    )
}

export async function getTrafficDomains() {
    return await requestService<TrafficDomains>('cdn', 'traffic/domains')
}

export async function getTrafficMetrics(domain?: string) {
    const params = new URLSearchParams()
    if (domain) {
        params.set('domain', domain)
    }

    return await requestService<TrafficMetrics>('cdn', `traffic/metrics?${params.toString()}`)
}

export async function getTrafficRecords(domain?: string, limit = 12, page = 1) {
    const params = new URLSearchParams({
        limit: String(limit),
        page: String(page),
    })
    if (domain) {
        params.set('domain', domain)
    }

    return await requestService<TrafficRecords>('cdn', `traffic/records?${params.toString()}`)
}

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
    const [metrics, vulnerabilities, domainTraffic] = await Promise.all([
        getTrafficMetrics(),
        getVulnerabilities(),
        getMetrics('domain'),
    ])

    const traffic = typeof metrics === 'string' ? null : metrics
    const vulnerabilityData = typeof vulnerabilities === 'string' ? null : vulnerabilities
    const topDomains = Array.isArray(traffic?.top_domains) ? traffic.top_domains.filter(domain => isMonitorDomain(domain.key)) : []
    const images = Array.isArray(vulnerabilityData?.images) ? vulnerabilityData.images : []

    return {
        requestsToday: domainTraffic.reduce((sum, metric) => sum + (Number(metric.hits_today) || 0), 0) || traffic?.total_requests || 0,
        requestsThisWeek: domainTraffic.reduce((sum, metric) => sum + (Number(metric.hits_last_week) || 0), 0),
        requestsThisMonth: domainTraffic.reduce((sum, metric) => sum + (Number(metric.hits_this_month) || 0), 0),
        requestsTotal: domainTraffic.reduce((sum, metric) => sum + (Number(metric.hits_total) || 0), 0),
        activeDomains: topDomains.length,
        totalVulnerabilities: images.reduce((sum, image) => sum + (Number(image.totalVulnerabilities) || 0), 0),
        criticalVulnerabilities: images.reduce((sum, image) => sum + (Number(image.severity?.critical) || 0), 0),
        imagesScanned: vulnerabilityData?.imageCount || 0,
        scanRunning: Boolean(vulnerabilityData?.scanStatus?.isRunning),
    }
}

function isMonitorDomain(value: string) {
    return Boolean(value && !value.startsWith('/') && !value.includes(' ') && (value.includes('.') || value === 'localhost') && !/^[\d.]+$/.test(value))
}
