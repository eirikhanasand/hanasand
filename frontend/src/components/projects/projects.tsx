import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import DashboardProject from './dashboardProject'

export default async function Projects() {
    const projects = await fetchThoughts()

    return (
        <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Projects</h1>
                <Link href='/s' className='flex gap-2 rounded-lg p-[3px] px-5 hover:outline-green-500/35 outline-1 outline-dark cursor-pointer hover:bg-green-500/20'>
                    <Plus />
                    <h1 className='font-semibold'>Create</h1>
                </Link>
            </div>
            {(projects as Thought[]).map((project) => <DashboardProject key={project.id} project={project} />)}
        </div>
    )
}
