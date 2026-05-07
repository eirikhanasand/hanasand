'use server'

import type {
    GetVulnerabilities,
    MonitoringOverview,
    TrafficDomains,
    TrafficMetrics,
    TrafficRecords,
} from './types'
import { requestService } from './serviceApi'

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
    const [metrics, vulnerabilities] = await Promise.all([
        getTrafficMetrics(),
        getVulnerabilities(),
    ])

    const traffic = typeof metrics === 'string' ? null : metrics
    const vulnerabilityData = typeof vulnerabilities === 'string' ? null : vulnerabilities
    const topDomains = Array.isArray(traffic?.top_domains) ? traffic.top_domains : []
    const images = Array.isArray(vulnerabilityData?.images) ? vulnerabilityData.images : []

    return {
        requestsToday: traffic?.total_requests || 0,
        activeDomains: topDomains.length,
        totalVulnerabilities: images.reduce((sum, image) => sum + (Number(image.totalVulnerabilities) || 0), 0),
        criticalVulnerabilities: images.reduce((sum, image) => sum + (Number(image.severity?.critical) || 0), 0),
        imagesScanned: vulnerabilityData?.imageCount || 0,
        scanRunning: Boolean(vulnerabilityData?.scanStatus?.isRunning),
    }
}
