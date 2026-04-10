import fetchThought from '@/utils/thoughts/fetchThought'
import prettyDate from '@/utils/date/prettyDate'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]

    const thought = await fetchThought(id)
    if (!thought) {
        notFound()
    }

    return (
        <div className='h-full'>
            <div className='p-8 md:px-16 lg:px-32 xl:px-64'>
                <div className='grid gap-4'>
                    <div className='flex justify-between items-center gap-4'>
                        <h1 className='text-2xl font-semibold'>{thought.title}</h1>
                        <span className='text-xs text-gray-500'>
                            {prettyDate(new Date(thought.created_at).toISOString())}
                        </span>
                    </div>
                    <p className='text-gray-500 text-sm'>
                        This thought does not have additional content yet, but you can manage it from your dashboard.
                    </p>
                </div>
            </div>
        </div>
    )
}
