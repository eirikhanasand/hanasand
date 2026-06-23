import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AutomationsClient from './pageClient'

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
