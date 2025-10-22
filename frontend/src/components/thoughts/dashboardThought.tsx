import Link from 'next/link'

export default function DashboardThought({ thought }: { thought: Thought }) {
    return (
        <Link href={`/thought/${thought.id}`} className='grid p-2 hover:bg-dark rounded-lg hover:scale-[1.005]'>
            <h1 key={thought.id}>{thought.title}</h1>
        </Link>
    )
}
