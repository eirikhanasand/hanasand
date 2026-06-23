import Shares from '@/components/share/dashboard/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Monitoring workspace'
                title='Shares'
                description='Review shared workspaces, customer handoffs, and delivery links.'
            />
            <div className='max-w-3xl'>
                <Shares />
            </div>
        </DashboardPage>
    )
}
