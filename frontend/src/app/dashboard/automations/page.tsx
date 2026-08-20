import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AutomationsClient from './simplePageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Automations',
    description: 'Check that everything is working as it should, and get alerted if something is wrong.',
}

export default async function Page({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const setup = Array.isArray(params?.setup) ? params?.setup[0] : params?.setup

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow={null}
                title='Automations'
            />
            <AutomationsClient setup={setup === 'dwm' ? 'dwm' : undefined} />
        </DashboardPage>
    )
}
