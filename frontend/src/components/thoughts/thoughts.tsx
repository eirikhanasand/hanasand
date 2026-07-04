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
                <h1 className='text-base font-medium text-ui-text'>Thoughts</h1>
                <Link href='/dashboard/thoughts/create' className='flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text transition hover:bg-ui-raised'>
                    <Plus className='h-4 w-4' />
                    Create
                </Link>
            </div>
            {list.length ? list.map((thought) => <DashboardThought key={thought.id} thought={thought} />) : (
                <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>Notebook queue is clear. Create a thought to start the stream.</p>
            )}
        </DashboardPanel>
    )
}
