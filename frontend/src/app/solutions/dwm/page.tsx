import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'
import DarkWebMonitoringPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Dark Web Monitoring',
    description: 'Dark web monitoring for company, vendor, domain, and ransomware actor mentions with webhook-ready alert payloads.',
    path: '/solutions/dwm',
    keywords: ['dark web monitoring', 'ransomware alerts', 'webhook threat intelligence', 'company exposure monitoring'],
})

export default function DarkWebMonitoringPage() {
    return <DarkWebMonitoringPageClient />
}
