import Projects from '@/components/projects/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Monitoring workspace'
                title='Projects'
                description='Open saved workspaces for monitoring, review, and customer-facing delivery.'
            />
            <div className='max-w-3xl'>
                <Projects />
            </div>
        </DashboardPage>
    )
}
