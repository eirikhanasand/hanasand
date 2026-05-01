import Link from 'next/link'
import { Plus } from 'lucide-react'
import DashboardProject from './dashboardProject'
import getProjects from '@/utils/projects/getProjects'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Projects() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value

    if (!token || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const projects = await getProjects({ id, token })

    return (
        <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Projects</h1>
                <Link href='/s' className='flex gap-2 rounded-lg p-[3px] px-5 hover:outline-green-500/35 outline-1 outline-dark cursor-pointer hover:bg-green-500/20'>
                    <Plus />
                    <h1 className='font-semibold select-none'>Create</h1>
                </Link>
            </div>
            {(projects as Project[]).map((project) => <DashboardProject key={project.alias} project={project} />)}
        </div>
    )
}
