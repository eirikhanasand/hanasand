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

    if (!sortedProjects.length) return <WorkspaceWelcome />

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
                        {!sortedProjects.length && <p className='text-sm text-ui-muted'>No recent activity.</p>}
                    </div>
                </div>
            </DashboardPanel>
        </div>
    )
}

function WorkspaceWelcome() {
    return (
        <section className='relative isolate grid min-h-[32rem] overflow-hidden rounded-2xl border border-ui-border bg-ui-panel px-6 py-10 text-center shadow-sm sm:px-12'>
            <div className='pointer-events-none absolute left-1/2 top-8 -z-10 h-56 w-[min(34rem,90%)] -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl' />
            <div className='mx-auto flex max-w-xl flex-col items-center justify-center'>
                <svg viewBox='0 0 280 170' role='img' aria-label='Fresh rows in a farm field' className='mb-7 h-44 w-72 drop-shadow-[0_16px_12px_rgba(15,23,42,0.2)]'>
                    <path d='M30 145h220' stroke='#64748b' strokeOpacity='.3' strokeWidth='8' strokeLinecap='round' />
                    <path d='M38 133 138 94l105 38-101 29z' fill='#7c4a2e' />
                    <path d='m58 132 80-29m-47 42 87-34m-39 44 88-35' stroke='#a86f42' strokeWidth='7' strokeLinecap='round' />
                    <path d='M137 123V72' stroke='#166534' strokeWidth='7' strokeLinecap='round' />
                    <path d='M137 90c-25-18-34-4-34-4 17 17 34 12 34 12m0-15c22-20 36-7 36-7-12 20-36 15-36 15' fill='#22c55e' stroke='#86efac' strokeWidth='3' />
                    <path d='M137 72c-8-24 9-37 9-37 13 17 2 36-9 37' fill='#4ade80' stroke='#86efac' strokeWidth='3' />
                    <circle cx='51' cy='125' r='5' fill='#fbbf24' /><circle cx='222' cy='128' r='5' fill='#fbbf24' />
                    <path d='M77 49c9-10 23-10 32-2 9-13 32-10 36 6H72c0-2 2-3 5-4Z' fill='#bfdbfe' fillOpacity='.75' />
                </svg>
                <p className='text-xs font-semibold uppercase tracking-[0.2em] text-ui-primary'>Workspace not started</p>
                <h2 className='mt-3 text-3xl font-semibold text-ui-text'>Workspaces</h2>
                <p className='mx-auto mt-3 max-w-lg text-base leading-7 text-ui-muted'>Create a workspace to gather files, collaborate with editors, and keep project movement in one place.</p>
                <Link href='/s' className='mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-5 text-sm font-semibold text-ui-canvas shadow-lg shadow-ui-primary/20 hover:opacity-90'><Plus className='h-4 w-4' />Create workspace</Link>
            </div>
        </section>
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
