import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import DashboardThought from './dashboardThought'

export default async function Thoughts() {
    const thoughts = await fetchThoughts()

    return (
        <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Thoughts</h1>
            </div>
            {(thoughts as Thought[]).map((thought) => <DashboardThought key={thought.id} thought={thought} />)}
        </div>
    )
}
