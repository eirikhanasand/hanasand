import DashboardThought from '@/components/thoughts/dashboardThought'
import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function Page() {
    const thoughts = await fetchThoughts()

    return (
        <div className='h-full'>
            <div className='p-16 md:px-50 lg:px-80 xl:px-120'>
                <div className='grid w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
                    <div className='flex justify-between'>
                        <h1 className='font-semibold text-lg'>Thoughts</h1>
                        <Link href='/dashboard/thoughts/create' className='flex gap-2 rounded-lg p-[3px] px-5 hover:outline-green-500/35 outline-1 outline-dark cursor-pointer hover:bg-green-500/20'>
                            <Plus />
                            <h1 className='font-semibold'>Create</h1>
                        </Link>
                    </div>
                    {(thoughts as Thought[]).map((thought) => <DashboardThought key={thought.id} thought={thought} />)}
                </div>
            </div>
        </div>
    )
}
