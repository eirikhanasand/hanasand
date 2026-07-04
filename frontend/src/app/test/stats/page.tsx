import TestStatsPageClient from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Service Check Results',
    description: 'Review service-check results and recent endpoint checks on Hanasand.',
    path: '/test/stats',
    keywords: ['service checks', 'endpoint checks', 'hanasand'],
})

export default function Page() {
    return (
        <div className='enterprise-console h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-ui-canvas px-3 py-3 text-ui-text sm:px-5 md:px-8 lg:px-10'>
            <div className='grid h-full w-full spawn overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-md'>
                <TestStatsPageClient />
            </div>
        </div>
    )
}
