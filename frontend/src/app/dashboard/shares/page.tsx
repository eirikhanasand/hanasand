import Shares from '@/components/share/dashboard/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Delivery'
                title='Customer handoffs'
                description='Review shared monitoring workspaces, delivery links, and customer-facing evidence packages.'
            />
            <div className='max-w-3xl'>
                <Shares />
            </div>
        </DashboardPage>
    )
}
