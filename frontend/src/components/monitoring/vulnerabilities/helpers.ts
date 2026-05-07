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
            scanStatus: {
                ...getFallbackStatus(),
                ...payload.scanStatus,
            },
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
    return {
        image: image.image || 'Unknown image',
        scannedAt: image.scannedAt || '',
        totalVulnerabilities: Number(image.totalVulnerabilities) || 0,
        severity: normalizeSeverity(image.severity),
        groups: Array.isArray(image.groups)
            ? image.groups.map((group) => ({
                source: group.source || 'Unknown source',
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
        scanError: image.scanError || null,
    }
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
