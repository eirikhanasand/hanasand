import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Dark Web Monitoring and Telegram Threat Alerts',
    description: 'Dark web and Telegram monitoring for company, vendor, domain, identity, session, token, and ransomware actor mentions with webhook-ready alert payloads.',
    path: '/dwm',
    keywords: ['dark web monitoring', 'telegram threat monitoring', 'ransomware alerts', 'infostealer monitoring', 'webhook threat intelligence', 'company exposure monitoring'],
})

export default async function DarkWebMonitoringPage() {
    const cookieStore = await cookies()
    if (cookieStore.get('id')?.value && cookieStore.get('access_token')?.value) {
        redirect('/dashboard/dwm')
    }

    redirect('/login?path=%2Fdashboard%2Fdwm')
}
