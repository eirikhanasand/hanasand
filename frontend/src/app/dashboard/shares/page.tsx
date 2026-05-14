import Shares from '@/components/share/dashboard/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Shares'
                title='Shares'
                description='Review shared spaces and create a new workspace.'
            />
            <div className='max-w-3xl'>
                <Shares />
            </div>
        </DashboardPage>
    )
}
