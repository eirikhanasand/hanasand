import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'
import OnionSessionPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Remote Tor Browser Session',
    description: 'Interactive isolated Tor Browser session with live remote input, direct clipboard sync, session controls, and broker-routed screen streaming.',
    path: '/solutions/onion-session',
    keywords: ['onion session workspace', 'dark web access workspace', 'threat intelligence collection', 'source tracking', 'p2p monitoring'],
})

export default function OnionSessionPage() {
    return <OnionSessionPageClient />
}
