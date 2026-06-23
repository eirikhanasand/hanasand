import LinkStatsPageClient from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Shortcut Statistics',
    description: 'Look up visit counts and destinations for Hanasand shortcut links.',
    path: '/g/stats',
    keywords: ['hanasand links', 'shortcut statistics'],
})

export default function Page() {
    return (
        <LinkStatsPageClient />
    )
}
