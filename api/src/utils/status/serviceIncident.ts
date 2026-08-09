export type ServiceMonitorObservation = {
    status: 'up' | 'down'
    checkedAt: string
    latencyMs: number
    message: string
    consecutiveFailures: number
}

export type ServiceMonitorIncidentInput = {
    service: string
    checkName: string
    status: 'up' | 'down'
    latencyMs: number
    message: string
    checkedAt: string
    consecutiveFailures: number
    incidentStartedAt: string
    observations: ServiceMonitorObservation[]
}

export async function notifyServiceMonitorIncident(input: ServiceMonitorIncidentInput) {
    const base = (process.env.TI_SCRAPER_API_BASE || 'http://ti-scraper:8097').replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN
    if (!token) throw new Error('TI_SCRAPER_SERVICE_TOKEN is not configured')

    const response = await fetch(`${base}/v1/intel/service-monitor-incidents`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-hanasand-service-token': token,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`Scraper service-monitor incident hook returned HTTP ${response.status}`)
}
