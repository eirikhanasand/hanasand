import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import DashboardThought from './dashboardThought'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

export default async function Thoughts() {
    const thoughts = await fetchThoughts()

    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full gap-2 p-4'>
            <div className='flex items-center justify-between gap-3'>
                <h1 className='text-base font-semibold text-bright'>Thoughts</h1>
                <Link href='/dashboard/thoughts/create' className='flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-bright/70 hover:bg-white/10'>
                    <Plus className='h-4 w-4' />
                    Create
                </Link>
            </div>
            {(thoughts as Thought[]).map((thought) => <DashboardThought key={thought.id} thought={thought} />)}
        </DashboardPanel>
    )
}
