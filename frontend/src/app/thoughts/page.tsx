import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import prettyDate from '@/utils/date/prettyDate'
import Link from 'next/link'
import { ArrowRight, Lightbulb } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const thoughts = await fetchThoughts()

    return (
        <main className='min-h-[90.5vh] px-4 py-8 md:px-12 lg:px-16'>
            <section className='mx-auto grid max-w-5xl gap-6'>
                <div className='grid gap-2'>
                    <div className='flex items-center gap-3 text-bright'>
                        <Lightbulb className='h-5 w-5 text-[#f0a17a]' />
                        <h1 className='text-2xl font-semibold tracking-[-0.02em]'>Thoughts</h1>
                    </div>
                    <p className='max-w-2xl text-sm leading-6 text-bright/50'>
                        Short notes and ideas, kept lightweight on purpose.
                    </p>
                </div>

                {!thoughts.length ? (
                    <div className='grid min-h-48 place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center'>
                        <div className='grid gap-3'>
                            <div className='mx-auto grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/4'>
                                <Lightbulb className='h-5 w-5 text-[#f0a17a]' />
                            </div>
                            <p className='text-sm text-bright/50'>No thoughts are published here yet.</p>
                        </div>
                    </div>
                ) : (
                    <div className='grid gap-2'>
                        {(thoughts as Thought[]).map((thought) => (
                            <Link
                                key={thought.id}
                                href={`/thoughts/${thought.id}`}
                                className='group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#f0a17a]/55'
                            >
                                <article className='flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-white/16 hover:bg-white/[0.055]'>
                                    <div className='min-w-0'>
                                        <h2 className='truncate text-base font-semibold text-bright/88'>{thought.title}</h2>
                                        <p className='mt-1 text-xs text-bright/38'>
                                            {prettyDate(new Date(thought.created_at).toISOString())}
                                        </p>
                                    </div>
                                    <ArrowRight className='h-4 w-4 shrink-0 text-bright/34 transition group-hover:translate-x-0.5 group-hover:text-bright/72' />
                                </article>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </main>
    )
}
