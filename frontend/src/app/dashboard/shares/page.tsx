import Shares from '@/components/share/dashboard/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Shares'
                title='Shares'
                description='Create and manage shared code.'
            />
            <Shares />
        </DashboardPage>
    )
}
