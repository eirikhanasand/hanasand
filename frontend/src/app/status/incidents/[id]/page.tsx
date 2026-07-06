import StatusDashboard from '../../pageClient'
import type { Metadata } from 'next'
import getStatus from '@/utils/status/getStatus'
import { publicStatusCoverageCheck, toPublicServiceStatus } from '@/utils/status/publicStatus'
import { buildRouteMetadata } from '../../../seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Incident Detail',
    description: 'Hanasand service incident timeline and resolution detail.',
    path: '/status/incidents',
    keywords: ['hanasand incident', 'incident detail', 'status history'],
})

export default async function page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const serviceStatus = await withFallback(getStatus(), getFallbackServiceStatus())

    return (
        <div className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-6 text-ui-text md:px-8'>
            <StatusDashboard serviceStatus={toPublicServiceStatus(serviceStatus)} mode='incident' incidentId={id} />
        </div>
    )
}

async function withFallback<T>(promise: Promise<T>, fallback: T, timeoutMs = 3500): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            promise,
            new Promise<T>((resolve) => {
                timeout = setTimeout(() => resolve(fallback), timeoutMs)
            }),
        ])
    } catch {
        return fallback
    } finally {
        if (timeout) {
            clearTimeout(timeout)
        }
    }
}

function getFallbackServiceStatus() {
    const generatedAt = new Date().toISOString()
    return {
        overall: 'degraded' as const,
        generated_at: generatedAt,
        checks: [publicStatusCoverageCheck(generatedAt)],
        history: [],
        incidents: [],
    }
}
