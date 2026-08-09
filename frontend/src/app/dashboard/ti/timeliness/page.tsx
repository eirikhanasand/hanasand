import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import TimelinessClient from './timelinessClient'

export const dynamic = 'force-dynamic'

export default async function TimelinessPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams
    const organizationId = firstParam(params?.organizationId)?.trim() || ''
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Report-to-alert timeliness'
                description='Resolve authoritative first-report evidence, inspect timestamp provenance, and measure retained incidents through alert delivery.'
            />
            <TimelinessClient initialOrganizationId={organizationId} />
        </DashboardPage>
    )
}

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}
