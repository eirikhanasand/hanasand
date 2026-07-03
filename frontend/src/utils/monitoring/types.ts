export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export type SeverityCount = Record<SeverityLevel, number>

export type VulnerabilityGroup = {
    source: string
    total: number
    severity: SeverityCount
}

export type VulnerabilityDetail = {
    id: string
    title: string
    severity: SeverityLevel
    source: string
    packageName: string | null
    packageType: string | null
    installedVersion: string | null
    fixedVersion: string | null
    description: string | null
    references: string[]
}

export type ImageVulnerabilityReport = {
    image: string
    scannedAt: string
    totalVulnerabilities: number
    severity: SeverityCount
    groups: VulnerabilityGroup[]
    vulnerabilities: VulnerabilityDetail[]
    scanError: string | null
}

export type DockerScoutScanStatus = {
    isRunning: boolean
    startedAt: string | null
    finishedAt: string | null
    lastSuccessAt: string | null
    lastError: string | null
    totalImages: number | null
    completedImages: number
    currentImage: string | null
    estimatedCompletionAt: string | null
    enabled: boolean
    paused: boolean
    schedule: string
    cadenceSeconds: number
    nextRunAt: string | null
    targetCount: number
    failureCount: number
    stale: boolean
    staleReason: string | null
    blocker: string | null
    blockerAction: string | null
    logs: Array<{
        at: string
        level: 'info' | 'warn' | 'error'
        message: string
    }>
}

export type GetVulnerabilities = {
    generatedAt: string | null
    imageCount: number
    images: ImageVulnerabilityReport[]
    scanStatus: DockerScoutScanStatus
}

export type TrafficMetric = {
    key: string
    count: number
}

export type TrafficSlowMetric = {
    key: string
    avg_time: number
}

export type TrafficMetrics = {
    total_requests: number
    avg_request_time: number
    error_rate: number
    top_methods: TrafficMetric[]
    top_status_codes: TrafficMetric[]
    top_domains: TrafficMetric[]
    top_os: TrafficMetric[]
    top_browsers: TrafficMetric[]
    requests_over_time: TrafficMetric[]
    top_error_paths: TrafficMetric[]
    top_slow_paths: TrafficSlowMetric[]
    top_paths: TrafficMetric[]
}

export type TrafficRecord = {
    id: number
    user_agent: string
    domain: string
    path: string
    method: string
    referer: string
    request_time: number
    status: number
    timestamp: string
    country_iso?: string | null
}

export type TrafficRecords = {
    result: TrafficRecord[]
    total: number
}

export type TrafficDomains = {
    domains: string[]
}

export type MonitoringOverview = {
    requestsToday: number
    activeDomains: number
    totalVulnerabilities: number
    criticalVulnerabilities: number
    imagesScanned: number
    scanRunning: boolean
}
