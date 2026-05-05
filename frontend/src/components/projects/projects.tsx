import Link from 'next/link'
import { Plus } from 'lucide-react'
import DashboardProject from './dashboardProject'
import getProjects from '@/utils/projects/getProjects'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPanel } from '@/components/dashboard/ui'

export default async function Projects() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value

    if (!token || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const projects = await getProjects({ id, token })

    return (
        <DashboardPanel className='grid min-h-42 content-start gap-3 p-4'>
            <div className='flex items-center justify-between gap-3'>
                <h2 className='text-base font-semibold text-bright/90'>Projects</h2>
                <Link href='/s' className='inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-bright/78 transition hover:bg-white/9 hover:text-bright'>
                    <Plus className='h-4 w-4' />
                    <span>Create</span>
                </Link>
            </div>
            <div className='grid gap-1'>
                {(projects as Project[]).length
                    ? (projects as Project[]).map((project) => <DashboardProject key={project.alias} project={project} />)
                    : <p className='text-sm text-bright/42'>No projects yet.</p>}
            </div>
        </DashboardPanel>
    )
}
