import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'
import BrowserPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Browser Sandbox',
    description: 'Unified regular-web and Tor browser workspace with saved investigation profiles, screenshot timeline capture, and SOC analyst summary output.',
    path: '/solutions/browser',
    keywords: ['browser investigation', 'malware url analysis', 'soc url analysis', 'tor browser workspace', 'browser screenshot timeline'],
})

export default function BrowserPage() {
    return <BrowserPageClient />
}
