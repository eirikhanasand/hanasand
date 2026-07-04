import Projects from '@/components/projects/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Monitoring'
                title='Workspaces'
                description='Open active workspaces, see recent movement, and jump into files without a dead landing page.'
            />
            <Projects />
        </DashboardPage>
    )
}
