import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'
import BrowserSandboxPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Regular Website Sandbox',
    description: 'Isolated regular-web browser sandbox with saved investigation profiles, screenshot timeline capture, and SOC analyst summary output.',
    path: '/solutions/browser-sandbox',
    keywords: ['website sandbox', 'malware url sandbox', 'soc url analysis', 'url investigation', 'browser screenshot timeline'],
})

export default function BrowserSandboxPage() {
    return <BrowserSandboxPageClient />
}
