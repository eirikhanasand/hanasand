import type { Metadata } from 'next'
import { buildRouteMetadata } from '../../seo'
import DarkWebMonitoringPageClient from './pageClient'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Dark Web Monitoring',
    description: 'Dark web monitoring for company, vendor, domain, and ransomware actor mentions with webhook-ready alert payloads.',
    path: '/solutions/dwm',
    keywords: ['dark web monitoring', 'ransomware alerts', 'webhook threat intelligence', 'company exposure monitoring'],
})

export default async function DarkWebMonitoringPage() {
    const cookieStore = await cookies()
    if (cookieStore.get('id')?.value && cookieStore.get('access_token')?.value) {
        redirect('/dashboard/dwm')
    }

    return <DarkWebMonitoringPageClient />
}
