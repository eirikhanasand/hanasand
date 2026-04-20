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

    return { data: payload, error: null }
}

export function impactScore(image: ImageVulnerabilityReport) {
    return image.severity.critical * 1000 + image.severity.high * 100 + image.severity.medium * 10 + image.severity.low
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
