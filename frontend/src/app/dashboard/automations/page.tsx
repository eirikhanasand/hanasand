import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AutomationsClient from './pageClient'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Agents'
                title='Automations'
                description='Create recurring agent work, test it immediately, and inspect results after the run has happened on the server.'
            />
            <AutomationsClient />
        </DashboardPage>
    )
}
