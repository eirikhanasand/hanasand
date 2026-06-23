import Projects from '@/components/projects/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Monitoring'
                title='Workspaces'
                description='Keep watchlists, review notes, and customer-facing monitoring work in one place.'
            />
            <div className='max-w-3xl'>
                <Projects />
            </div>
        </DashboardPage>
    )
}
