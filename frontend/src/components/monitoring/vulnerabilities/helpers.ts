import type { GetVulnerabilities, ImageVulnerabilityReport } from '@/utils/monitoring/types'
import type { VulnerabilityPageState } from './types'

export function getFallbackStatus(): GetVulnerabilities['scanStatus'] {
    return {
        isRunning: false,
        startedAt: null,
        finishedAt: null,
        lastSuccessAt: null,
        lastError: null,
        totalImages: null,
        completedImages: 0,
        currentImage: null,
        estimatedCompletionAt: null,
        enabled: true,
        paused: false,
        schedule: 'Watching',
        cadenceSeconds: 0,
        nextRunAt: null,
        targetCount: 0,
        failureCount: 0,
        stale: true,
        staleReason: 'Scanner status is refreshing.',
        blocker: null,
        blockerAction: null,
        logs: [],
    }
}

export function toPageState(payload: GetVulnerabilities | string): VulnerabilityPageState {
    if (!payload || typeof payload === 'string') {
        return { data: null, error: typeof payload === 'string' ? payload : 'Failed to load vulnerability report.' }
    }

    if (!Array.isArray(payload.images) || !payload.scanStatus) {
        return { data: null, error: 'The vulnerability API returned an unexpected response.' }
    }

    return {
        data: {
            ...payload,
            imageCount: Number(payload.imageCount) || payload.images.length,
            images: payload.images.map(normalizeImageReport),
            scanStatus: normalizeScanStatus(payload.scanStatus),
        },
        error: null,
    }
}

export function impactScore(image: ImageVulnerabilityReport) {
    return (Number(image.severity?.critical) || 0) * 1000
        + (Number(image.severity?.high) || 0) * 100
        + (Number(image.severity?.medium) || 0) * 10
        + (Number(image.severity?.low) || 0)
}

function normalizeSeverity(value: Partial<ImageVulnerabilityReport['severity']> | undefined): ImageVulnerabilityReport['severity'] {
    return {
        critical: Number(value?.critical) || 0,
        high: Number(value?.high) || 0,
        medium: Number(value?.medium) || 0,
        low: Number(value?.low) || 0,
        unknown: Number(value?.unknown) || 0,
    }
}

function normalizeImageReport(image: Partial<ImageVulnerabilityReport>): ImageVulnerabilityReport {
    const scanError = normalizeScanError(image.scanError)
    return {
        image: image.image || 'Image checking',
        scannedAt: image.scannedAt || '',
        totalVulnerabilities: Number(image.totalVulnerabilities) || 0,
        severity: normalizeSeverity(image.severity),
        groups: Array.isArray(image.groups)
            ? image.groups.map((group) => ({
                source: group.source || 'Source checking',
                total: Number(group.total) || 0,
                severity: normalizeSeverity(group.severity),
            }))
            : [],
        vulnerabilities: Array.isArray(image.vulnerabilities)
            ? image.vulnerabilities.map((vulnerability) => ({
                id: vulnerability.id || 'unknown',
                title: vulnerability.title || 'Untitled finding',
                severity: vulnerability.severity || 'unknown',
                source: vulnerability.source || '',
                packageName: vulnerability.packageName || null,
                packageType: vulnerability.packageType || null,
                installedVersion: vulnerability.installedVersion || null,
                fixedVersion: vulnerability.fixedVersion || null,
                description: vulnerability.description || null,
                references: Array.isArray(vulnerability.references) ? vulnerability.references : [],
            }))
            : [],
        scanError,
    }
}

function normalizeScanStatus(status: Partial<GetVulnerabilities['scanStatus']>): GetVulnerabilities['scanStatus'] {
    const fallback = getFallbackStatus()
    return {
        ...fallback,
        ...status,
        targetCount: Number(status.targetCount) || Number(status.totalImages) || fallback.targetCount,
        failureCount: Number(status.failureCount) || 0,
        logs: Array.isArray(status.logs)
            ? status.logs.map(log => ({
                at: log.at || '',
                level: log.level === 'error' || log.level === 'warn' || log.level === 'info' ? log.level : severityFromLogLine(log.message),
                message: log.message || '',
            })).filter(log => log.message)
            : [],
    }
}

function normalizeScanError(value: string | null | undefined) {
    if (!value) return null
    return severityFromLogLine(value) === 'info' ? null : value
}

function severityFromLogLine(value: string) {
    if (/\b(?:error|fatal|failed|failure|denied|blocked|unavailable)\b/i.test(value)) return 'error'
    if (/\bwarn(?:ing)?\b/i.test(value)) return 'warn'
    return 'info'
}

function formatDuration(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return minutes <= 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
}

export function formatEta(timestamp: string | null, now: number) {
    if (!timestamp) return 'Estimating…'
    const remainingSeconds = Math.max(0, Math.ceil((new Date(timestamp).getTime() - now) / 1000))
    if (remainingSeconds <= 300) {
        return remainingSeconds > 0 ? `${formatDuration(remainingSeconds)} remaining` : 'Any moment now'
    }

    return new Date(timestamp).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
