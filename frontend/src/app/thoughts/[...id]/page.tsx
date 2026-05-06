import fetchThought from '@/utils/thoughts/fetchThought'
import prettyDate from '@/utils/date/prettyDate'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Lightbulb } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]

    const thought = await fetchThought(id)
    if (!thought) {
        notFound()
    }

    return (
        <main className='min-h-[90.5vh] px-4 py-8 md:px-12 lg:px-16'>
            <article className='mx-auto grid max-w-3xl gap-4'>
                <Link
                    href='/thoughts'
                    className='inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-medium text-bright/60 transition hover:bg-white/7 hover:text-bright'
                >
                    <ArrowLeft className='h-4 w-4' />
                    Thoughts
                </Link>

                <section className='grid gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 md:p-6'>
                    <div className='grid gap-3'>
                        <div className='flex items-center gap-2 text-sm font-medium text-bright/50'>
                            <Lightbulb className='h-4 w-4 text-[#f0a17a]' />
                            Thought
                        </div>
                        <h1 className='text-3xl font-semibold leading-tight tracking-[-0.03em] text-bright md:text-4xl'>{thought.title}</h1>
                    </div>
                    <div className='flex flex-wrap gap-2 text-xs text-bright/45'>
                        <span className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/12 px-3 py-2'>
                            <CalendarDays className='h-3.5 w-3.5 text-[#f0a17a]' />
                            Published {prettyDate(new Date(thought.created_at).toISOString())}
                        </span>
                    </div>
                </section>

                <section className='rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm leading-6 text-bright/50 md:p-6'>
                    This thought does not have additional content yet.
                </section>
            </article>
        </main>
    )
}
