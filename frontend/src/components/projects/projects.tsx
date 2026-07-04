import Link from 'next/link'
import { Clock3, FolderKanban, Plus, Users } from 'lucide-react'
import DashboardProject from './dashboardProject'
import getProjects from '@/utils/projects/getProjects'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPanel } from '@/components/dashboard/ui'
import prettyDate from '@/utils/date/prettyDate'
import type { ReactNode } from 'react'

export default async function Projects() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value

    if (!token || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const projects = await getProjects({ id, token })
    const sortedProjects = [...(projects as Project[])].sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    const activeProject = sortedProjects[0]
    const fileCount = sortedProjects.reduce((sum, project) => sum + (project.file_count || 0), 0)
    const editorCount = new Set(sortedProjects.flatMap((project) => project.editors || [])).size

    return (
        <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]'>
            <DashboardPanel className='grid content-start gap-3 border-ui-border bg-ui-panel p-3'>
                <div className='flex flex-col gap-3 border-b border-ui-border pb-3 lg:flex-row lg:items-center lg:justify-between'>
                    <div className='grid gap-2 sm:grid-cols-3'>
                        <WorkspaceMetric icon={<FolderKanban className='h-4 w-4' />} label='Workspaces' value={String(sortedProjects.length)} />
                        <WorkspaceMetric icon={<Clock3 className='h-4 w-4' />} label='Latest update' value={activeProject ? prettyDate(activeProject.last_updated) : 'Listening'} />
                        <WorkspaceMetric icon={<Users className='h-4 w-4' />} label='Editors' value={String(editorCount)} />
                    </div>
                    <Link href='/s' className='inline-flex h-9 w-fit items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10'>
                        <Plus className='h-4 w-4' />
                        <span>Create workspace</span>
                    </Link>
                </div>
                <div className='grid max-h-[calc(100vh-18rem)] gap-1 overflow-auto pr-1'>
                    {sortedProjects.length
                        ? sortedProjects.map((project) => <DashboardProject key={project.alias} project={project} />)
                        : <p className='rounded-md border border-dashed border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>Create or open a workspace to start activity.</p>}
                </div>
            </DashboardPanel>
            <DashboardPanel className='grid content-start gap-3 border-ui-border bg-ui-panel p-3'>
                <div className='rounded-md border border-ui-border bg-ui-canvas p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Active workspace</p>
                    <p className='mt-1 truncate text-base font-semibold text-ui-text'>{activeProject?.alias || 'Monitoring workspace'}</p>
                    <p className='mt-1 text-xs text-ui-muted'>{activeProject ? `${activeProject.file_count || 0} files · ${activeProject.editors?.length || 0} editors` : 'Create or open a workspace.'}</p>
                </div>
                <WorkspaceMetric icon={<FolderKanban className='h-4 w-4' />} label='Files' value={String(fileCount)} />
                <div className='rounded-md border border-ui-border bg-ui-canvas p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Recent movement</p>
                    <div className='mt-2 grid gap-2'>
                        {sortedProjects.slice(0, 5).map((project) => (
                            <Link key={project.alias} href={`/p/${project.alias}`} className='block rounded-md border border-ui-border bg-ui-canvas px-3 py-2 hover:border-ui-border hover:bg-ui-primary/10'>
                                <p className='truncate text-sm font-semibold text-ui-text'>{project.alias || 'Untitled project'}</p>
                                <p className='truncate text-xs text-ui-muted'>{prettyDate(project.last_updated)}</p>
                            </Link>
                        ))}
                        {!sortedProjects.length && <p className='text-sm text-ui-muted'>Workspace movement streams here as files change.</p>}
                    </div>
                </div>
            </DashboardPanel>
        </div>
    )
}

function WorkspaceMetric({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-canvas px-3 py-2'>
            <div className='flex items-center gap-2 text-ui-muted'>
                {icon}
                <span className='text-xs font-semibold uppercase'>{label}</span>
            </div>
            <p className='mt-1 truncate text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}
