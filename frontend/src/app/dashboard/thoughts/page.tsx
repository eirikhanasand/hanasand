import DashboardThought from '@/components/thoughts/dashboardThought'
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
        <div className='grid gap-5 py-4'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div>
                    <p className='text-xs uppercase tracking-[0.35em] text-orange-200/70'>Notebook</p>
                    <h1 className='mt-2 text-3xl font-semibold tracking-[-0.04em] text-bright'>Thoughts</h1>
                </div>
                <Link href='/dashboard/thoughts/create' className='flex gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-bright/78 hover:border-green-500/35 hover:bg-green-500/15'>
                    <Plus />
                    <span>Create</span>
                </Link>
            </div>
            <section className='glass-card rounded-[1.4rem] p-5'>
                <div className='grid gap-2'>
                    {displayedThoughts.map((thought) => <DashboardThought key={thought.id} thought={thought} />)}
                </div>
            </section>
        </div>
    )
}
