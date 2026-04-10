import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import prettyDate from '@/utils/date/prettyDate'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const thoughts = await fetchThoughts()

    if (!thoughts.length) {
        return (
            <div className='w-full h-full grid place-items-center'>
                <h1 className='font-semibold text-xl text-glow'>No thoughts yet.</h1>
            </div>
        )
    }

    return (
        <div className='h-full'>
            <div className='p-8 md:px-16 lg:px-32 xl:px-64'>
                <div className='grid gap-4'>
                    <h1 className='text-foreground text-2xl font-semibold'>Thoughts</h1>
                    <p className='text-gray-500 text-sm'>A collection of thoughts and ideas.</p>
                    <div className='grid gap-2'>
                        {(thoughts as Thought[]).map((thought) => (
                            <Link key={thought.id} href={`/thoughts/${thought.id}`} className='group'>
                                <div className='flex justify-between items-center p-3 rounded-lg outline-1 outline-dark hover:bg-dark hover:scale-[1.005] transition-1000'>
                                    <div className='flex flex-col'>
                                        <span className='font-medium'>{thought.title}</span>
                                        <span className='text-xs text-gray-500 mt-1'>
                                            {prettyDate(new Date(thought.created_at).toISOString())}
                                        </span>
                                    </div>
                                    <span className='text-xs text-gray-500 group-hover:text-foreground'>View →</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
