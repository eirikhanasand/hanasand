import type { Metadata } from 'next'
import { tiScraperApiBase } from '@/utils/dwm/scraperApiBase'
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
    const target = new URL('/v1/dwm/exposure-queue', tiScraperApiBase())
    target.searchParams.set('limit', '50')
    target.searchParams.set('offset', '0')

    try {
        const response = await fetch(target, {
            cache: 'no-store',
            signal: AbortSignal.timeout(3500),
        })
        if (!response.ok) return null
        return normalizeExposureQueue(await response.json())
    } catch {
        return null
    }
}

function emptyExposureQueue(): ExposureQueue {
    return {
        generatedAt: new Date().toISOString(),
        status: 'checking',
        freshness: { latestClaimAt: null, ageMinutes: null, maxLiveAgeMinutes: 60 },
        scheduler: { state: 'due', cadenceSeconds: 300 },
        counts: { visible: 0, total: 0, needsReview: 0, metadataOnly: 0 },
        page: { limit: 50, offset: 0, total: 0, nextOffset: null, hasMore: false },
        items: [],
    }
}
