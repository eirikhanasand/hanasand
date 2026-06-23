import Shares from '@/components/share/dashboard/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Delivery'
                title='Shared reports'
                description='Review monitoring report links, customer delivery pages, and shared exposure review work.'
            />
            <div className='max-w-3xl'>
                <Shares />
            </div>
        </DashboardPage>
    )
}
