import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'
import OnionSessionPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Onion Session Workspace',
    description: 'Short-span isolated onion-network session workspace with remote controls, route state, notes, and source tracking.',
    path: '/solutions/onion-session',
    keywords: ['onion session workspace', 'dark web access workspace', 'threat intelligence collection', 'source tracking', 'p2p monitoring'],
})

export default function OnionSessionPage() {
    return <OnionSessionPageClient />
}
