import DashboardThought from '@/components/thoughts/dashboardThought'
import fetchThoughts from '@/utils/thoughts/fetchThoughts'

export default async function Page() {
    const thoughts = await fetchThoughts()

    return (
        <div className='h-full'>
            <div className='p-16'>
                <div className='grid w-full p-2 bg-dark rounded-lg gap-2'>
                    <h1 className='font-semibold text-lg'>Thoughts</h1>
                    {(thoughts as Thought[]).map((thought) => <DashboardThought key={thought.id} thought={thought} />)}
                </div>
            </div>
        </div>
    )
}
