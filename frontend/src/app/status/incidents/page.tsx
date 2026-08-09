import StatusDashboard from '../pageClient'
import type { Metadata } from 'next'
import getStatus from '@/utils/status/getStatus'
import { toPublicServiceStatus } from '@/utils/status/publicStatus'
import { buildRouteMetadata } from '../../seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Incident History',
    description: 'Recent Hanasand service incidents and status messages.',
    path: '/status/incidents',
    keywords: ['hanasand incidents', 'status incidents', 'incident history'],
})

export default async function page() {
    const serviceStatus = await getStatus()

    return (
        <div className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-6 text-ui-text md:px-8'>
            <StatusDashboard serviceStatus={toPublicServiceStatus(serviceStatus)} mode='incidents' />
        </div>
    )
}
