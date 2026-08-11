import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import config from '@/config'
import { buildRouteMetadata } from '../seo'
import BrowserPageClient, { sanitizeHistory, type BrowserInitialData } from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Browser',
    description: 'Unified regular-web and Tor browser workspace with saved investigation profiles, screenshot timeline capture, and SOC analyst summary output.',
    path: '/browser',
    keywords: ['browser investigation', 'malware url analysis', 'soc url analysis', 'tor browser workspace', 'browser screenshot timeline'],
})

export const dynamic = 'force-dynamic'

export default async function BrowserPage() {
    return <BrowserPageClient initialData={await loadBrowserInitialData()} />
}

async function loadBrowserInitialData(): Promise<BrowserInitialData> {
    const fallback: BrowserInitialData = { history: [], quota: null, stats: { runs24h: 0, darkwebRuns24h: 0 } }
    try {
        const cookieStore = await cookies()
        const clientId = cookieStore.get('hanasand:browser:client-id:v1')?.value
        const accessToken = cookieStore.get('access_token')?.value
        const userId = cookieStore.get('id')?.value
        const headers = new Headers()
        if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
        if (userId) headers.set('id', userId)
        const apiBase = config.url.api.replace(/\/$/, '')
        const runsUrl = new URL(`${apiBase}/browser/runs`)
        if (clientId) runsUrl.searchParams.set('clientId', clientId)
        const [runsResponse, statsResponse] = await Promise.all([
            fetch(runsUrl, { headers, cache: 'no-store', signal: AbortSignal.timeout(3_000) }),
            fetch(`${apiBase}/browser/stats`, { cache: 'no-store', signal: AbortSignal.timeout(3_000) }),
        ])
        const [runs, stats] = await Promise.all([
            runsResponse.ok ? runsResponse.json() as Promise<{ runs?: unknown[]; quota?: BrowserInitialData['quota'] }> : null,
            statsResponse.ok ? statsResponse.json() as Promise<BrowserInitialData['stats']> : null,
        ])
        return {
            history: sanitizeHistory(runs?.runs),
            quota: runs?.quota || null,
            stats: stats || fallback.stats,
        }
    } catch {
        return fallback
    }
}
