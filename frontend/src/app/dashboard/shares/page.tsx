import Shares from '@/components/share/dashboard/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Code sharing'
                title='Code shares and projects'
                description='Shared code rows, workspace links, access state, and recent movement.'
            />
            <Shares />
        </DashboardPage>
    )
}
