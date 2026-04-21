import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import DashboardThought from './dashboardThought'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function Thoughts() {
    const thoughts = await fetchThoughts()

    return (
        <section className='grid h-fit min-w-0 w-full gap-2 rounded-xl border border-white/10 bg-white/4 p-4'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Thoughts</h1>
                <Link href='/dashboard/thoughts/create' className='flex gap-2 rounded-lg p-1.25 px-5 hover:outline-green-500/35 outline-1 outline-dark cursor-pointer hover:bg-green-500/20'>
                    <Plus />
                    <h1 className='font-semibold select-none'>Create</h1>
                </Link>
            </div>
            {(thoughts as Thought[]).map((thought) => <DashboardThought key={thought.id} thought={thought} />)}
        </section>
    )
}
