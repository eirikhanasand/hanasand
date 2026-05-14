import Projects from '@/components/projects/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Projects'
                title='Projects'
                description='Open and create production workspaces.'
            />
            <div className='max-w-3xl'>
                <Projects />
            </div>
        </DashboardPage>
    )
}
