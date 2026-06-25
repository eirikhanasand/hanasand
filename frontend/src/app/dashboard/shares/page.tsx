import Shares from '@/components/share/dashboard/projects'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default function Page() {
    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Code sharing'
                title='Code shares and projects'
                description='Manage paste-style code files, shared snippets, and full project workspaces.'
            />
            <div className='max-w-3xl'>
                <Shares />
            </div>
        </DashboardPage>
    )
}
