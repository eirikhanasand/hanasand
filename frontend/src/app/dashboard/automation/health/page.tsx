import { Suspense } from 'react'
import { DashboardDataFallback, DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AutomationsClient from '../simplePageClient'
import { loadAutomations } from '@/utils/automations/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Health Checks',
    description: 'Configure monitoring jobs and alert destinations.',
}

export default function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    return <DashboardPage><DashboardHeader eyebrow={null} title='Automation' /><Suspense fallback={<DashboardDataFallback label='health checks' />}><HealthChecks searchParams={searchParams} /></Suspense></DashboardPage>
}

async function HealthChecks({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const initial = await loadAutomations(typeof params?.monitor === 'string' ? params.monitor : undefined)
    const setup = Array.isArray(params?.setup) ? params.setup[0] : params?.setup
    return <AutomationsClient initial={initial} setup={setup === 'dwm' ? 'dwm' : undefined} />
}
