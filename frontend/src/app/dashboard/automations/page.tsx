import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AutomationsClient from './pageClient'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Alert delivery'
                title='Monitoring alerts'
                description='Create scheduled checks, test delivery, and review recent alert runs from the customer console.'
            />
            <AutomationsClient />
        </DashboardPage>
    )
}
