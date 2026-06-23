import DashboardThought from '@/components/thoughts/dashboardThought'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const thoughts = await fetchThoughts()
    const fallbackThoughts: Thought[] = [
        { id: 'shower-1', title: 'Is there wind underwater, or is that just current with better branding?', created_at: '', created_by: 'system', updated_at: '' },
        { id: 'shower-2', title: 'If a mountain is slowly moving, is hiking just very patient surfing?', created_at: '', created_by: 'system', updated_at: '' },
        { id: 'shower-3', title: 'Why do we call them buildings if they are already built?', created_at: '', created_by: 'system', updated_at: '' },
        { id: 'shower-4', title: 'If two people read the same book years apart, do they ever meet in the same thought?', created_at: '', created_by: 'system', updated_at: '' },
    ]
    const displayedThoughts = thoughts.length ? thoughts : fallbackThoughts

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Notebook'
                title='Thoughts'
                description='Short personal notes and working observations, kept inside the same console structure as the rest of the product.'
                actions={
                    <Link href='/dashboard/thoughts/create' className='flex h-9 items-center gap-2 rounded-lg bg-[#22252d] px-3.5 text-sm font-medium text-white transition hover:bg-[#111318]'>
                        <Plus className='h-4 w-4' />
                        <span>Create</span>
                    </Link>
                }
            />
            <DashboardPanel className='p-4'>
                <div className='grid gap-2'>
                    {displayedThoughts.map((thought) => <DashboardThought key={thought.id} thought={thought} />)}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}
