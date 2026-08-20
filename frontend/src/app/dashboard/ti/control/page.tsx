import Link from 'next/link'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { Activity, ArrowLeft, DatabaseZap, ExternalLink } from 'lucide-react'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import { proxyTiRequest } from '@/app/api/dwm/_tiProxy'
import TiScraperControlClient from './scraperControlClient'

export const dynamic = 'force-dynamic'

export default async function TiScraperControlPage() {
    const initialWatchlistState = await getInitialWatchlistState()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Collection'
                description='Watch live sources, collection pressure, coverage, and alert rebuilds.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/ti' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-raised'>
                            <ArrowLeft className='h-4 w-4' />
                            Intelligence
                        </Link>
                        <Link href='/dashboard/ti/attacks' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-raised'>
                            <Activity className='h-4 w-4' />
                            Attacks
                        </Link>
                        <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-panel'>
                            <DatabaseZap className='h-4 w-4' />
                            Sources
                            <ExternalLink className='h-4 w-4' />
                        </Link>
                    </div>
                )}
            />
            <TiScraperControlClient initialWatchlistState={initialWatchlistState} />
        </DashboardPage>
    )
}

async function getInitialWatchlistState(): Promise<'empty' | 'populated' | 'unknown'> {
    const cookieStore = await cookies()
    const request = new NextRequest('http://localhost/api/dwm/watchlists', {
        headers: { cookie: cookieStore.toString() },
    })
    const response = await proxyTiRequest(request, '/v1/dwm/watchlists', { method: 'GET' })
    if (!response.ok) return 'unknown'

    try {
        const payload = await response.json() as { watchlists?: unknown[] }
        if (!Array.isArray(payload.watchlists)) return 'unknown'
        return payload.watchlists.length ? 'populated' : 'empty'
    } catch {
        return 'unknown'
    }
}
