import StatusDashboard from '../../pageClient'
import type { Metadata } from 'next'
import getStatus from '@/utils/status/getStatus'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'
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
    const serviceStatus = await getStatus()

    return (
        <div className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-6 text-ui-text md:px-8'>
            <StatusDashboard serviceStatus={toPublicServiceStatus(serviceStatus)} mode='incident' incidentId={id} />
        </div>
    )
}
