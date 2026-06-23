import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import DashboardThought from './dashboardThought'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

export default async function Thoughts() {
    const thoughts = await fetchThoughts()
    const list = thoughts as Thought[]

    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full gap-2 p-4'>
            <div className='flex items-center justify-between gap-3'>
                <h1 className='text-base font-medium text-[#171a21]'>Thoughts</h1>
                <Link href='/dashboard/thoughts/create' className='flex h-9 items-center gap-2 rounded-lg border border-[#dfe5ee] bg-white px-3 text-sm font-medium text-[#28303d] shadow-sm transition hover:border-[#b9c6d8] hover:bg-[#f7f9fc]'>
                    <Plus className='h-4 w-4' />
                    Create
                </Link>
            </div>
            {list.length ? list.map((thought) => <DashboardThought key={thought.id} thought={thought} />) : (
                <p className='rounded-lg border border-dashed border-[#dfe5ee] p-3 text-sm text-[#6b7280]'>No thoughts yet.</p>
            )}
        </DashboardPanel>
    )
}
