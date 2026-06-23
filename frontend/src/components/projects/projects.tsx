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
                <div>
                    <h2 className='text-base font-semibold text-[#171a21]'>Projects</h2>
                    <p className='mt-1 text-sm text-[#596170]'>{(projects as Project[]).length} workspace{(projects as Project[]).length === 1 ? '' : 's'}</p>
                </div>
                <Link href='/s' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#364152] transition hover:bg-[#f2f5f9]'>
                    <Plus className='h-4 w-4' />
                    <span>Create</span>
                </Link>
            </div>
            <div className='grid gap-1'>
                {(projects as Project[]).length
                    ? (projects as Project[]).map((project) => <DashboardProject key={project.alias} project={project} />)
                    : <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#596170]'>No projects yet.</p>}
            </div>
        </DashboardPanel>
    )
}
