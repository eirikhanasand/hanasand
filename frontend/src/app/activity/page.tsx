import type { Metadata } from 'next'
import { fetchSharedExposureQueue } from '@/utils/dwm/sharedExposureQueue'
import { buildRouteMetadata } from '../seo'
import ActivityClient from './activityClient'
import { exposureQueueFallback, normalizeExposureQueue, type ExposureQueue } from '../exposureQueue'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Activity',
    description: 'Fullscreen company exposure activity with filters for actor, company, data mentioned, and dates.',
    path: '/activity',
    keywords: ['hanasand activity', 'company exposure activity', 'dark web activity filters'],
})

export default async function ActivityPage() {
    const initialQueue = await loadExposureQueue()
    return <ActivityClient initialQueue={initialQueue} />
}

async function loadExposureQueue(): Promise<ExposureQueue> {
    try {
        const response = await fetchSharedExposureQueue(new URLSearchParams({ limit: '50', offset: '0' }), { timeoutMs: 3500 })
        if (!response.ok) return exposureQueueFallback('unavailable', 50)
        return normalizeExposureQueue(await response.json())
    } catch (error) {
        return exposureQueueFallback(isTimeoutError(error) ? 'checking' : 'unavailable', 50)
    }
}

function isTimeoutError(error: unknown) {
    return error instanceof Error && error.name === 'TimeoutError'
}
