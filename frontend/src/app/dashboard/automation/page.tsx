import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AutomationsClient from './simplePageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Automation',
    description: 'Configure monitoring jobs and alert destinations.',
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const setup = Array.isArray(params?.setup) ? params.setup[0] : params?.setup
    return <DashboardPage><DashboardHeader eyebrow={null} title='Automation' /><AutomationsClient setup={setup === 'dwm' ? 'dwm' : undefined} /></DashboardPage>
}
