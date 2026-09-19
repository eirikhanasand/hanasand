import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import TimelinessClient from './timelinessClient'

export const dynamic = 'force-dynamic'

export default function TimelinessPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Delivery'
                description='Track automatically recorded collection, processing, and alert delivery events. Add public report evidence only when the source did not provide it.'
            />
            <TimelinessClient />
        </DashboardPage>
    )
}
