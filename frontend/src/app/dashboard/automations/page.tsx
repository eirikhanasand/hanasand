import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AutomationsClient from './pageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Alerts Portal',
    description: 'Create monitoring, mail, system, and delivery-test alerts and review recent alert runs.',
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
                eyebrow='Alert portal'
                title='Alerts'
                description='Create monitoring, mail, system, and delivery-test alerts from one operator console.'
            />
            <AutomationsClient setup={setup === 'dwm' ? 'dwm' : undefined} />
        </DashboardPage>
    )
}
