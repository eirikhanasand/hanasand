import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AutomationsClient from './pageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Webhooks and Alerts',
    description: 'Create monitoring alerts, prepare dark web monitoring webhook delivery, and review recent alert runs.',
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
                eyebrow='Alert delivery'
                title='Monitoring alerts'
                description='Create scheduled checks, test delivery, and review recent alert runs from the customer console.'
            />
            <AutomationsClient setup={setup === 'dwm' ? 'dwm' : undefined} />
        </DashboardPage>
    )
}
