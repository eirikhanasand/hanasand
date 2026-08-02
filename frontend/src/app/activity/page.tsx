import type { Metadata } from 'next'
import { fetchSharedExposureQueue } from '@/utils/dwm/sharedExposureQueue'
import { buildRouteMetadata } from '../seo'
import ActivityClient from './activityClient'
import { normalizeExposureQueue, type ExposureQueue } from '../exposureQueue'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Activity',
    description: 'Fullscreen company exposure activity with filters for actor, company, data mentioned, and dates.',
    path: '/activity',
    keywords: ['hanasand activity', 'company exposure activity', 'dark web activity filters'],
})

export default async function ActivityPage() {
    const initialQueue = await loadExposureQueue() || emptyExposureQueue()
    return <ActivityClient initialQueue={initialQueue} />
}

async function loadExposureQueue(): Promise<ExposureQueue | null> {
    try {
        const response = await fetchSharedExposureQueue(new URLSearchParams({ limit: '50', offset: '0' }), { timeoutMs: 3500 })
        if (!response.ok) return null
        return normalizeExposureQueue(await response.json())
    } catch {
        return null
    }
}

function emptyExposureQueue(): ExposureQueue {
    return {
        generatedAt: new Date().toISOString(),
        status: 'unavailable',
        freshness: { latestClaimAt: null, ageMinutes: null, maxLiveAgeMinutes: 60 },
        scheduler: { state: 'unavailable', cadenceSeconds: 300 },
        counts: { visible: 0, total: 0, needsReview: 0, metadataOnly: 0 },
        page: { limit: 50, offset: 0, total: 0, nextOffset: null, hasMore: false },
        items: [],
    }
}
