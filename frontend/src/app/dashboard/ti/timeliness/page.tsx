import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import TimelinessClient from './timelinessClient'

export const dynamic = 'force-dynamic'

export default function TimelinessPage() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Report-to-alert timeliness'
                description='Resolve authoritative first-report evidence, inspect timestamp provenance, and measure retained incidents through alert delivery.'
            />
            <TimelinessClient />
        </DashboardPage>
    )
}
