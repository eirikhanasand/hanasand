import quotes from './quotes.json'
import type { Metadata } from 'next'
import { Quote } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Quotes | Hanasand',
    description: 'A readable wall of short quotes and notes saved on Hanasand.',
}

export default function page() {
    const uniqueQuotes = Array.from(new Set(Array.isArray(quotes) ? quotes : []))

    return (
        <main className='min-h-[90.5vh] px-4 py-8 md:px-12 lg:px-16'>
            <section className='mx-auto grid max-w-7xl gap-6'>
                <div className='grid gap-2'>
                    <div className='flex items-center gap-3 text-bright'>
                        <Quote className='h-5 w-5 text-[#f0a17a]' />
                        <h1 className='text-2xl font-semibold tracking-[-0.02em]'>Quotes</h1>
                    </div>
                    <p className='max-w-2xl text-sm leading-6 text-bright/50'>
                        A quiet place to read the saved notes without the old auto-scrolling wall.
                    </p>
                    <p className='text-xs uppercase tracking-[0.18em] text-bright/32'>{uniqueQuotes.length} saved notes</p>
                </div>

                <div className='columns-1 gap-3 sm:columns-2 xl:columns-3'>
                    {uniqueQuotes.map((quote, index) => (
                        <blockquote
                            key={`${index}-${quote.slice(0, 24)}`}
                            className='mb-3 break-inside-avoid rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-bright/68 shadow-[0_14px_44px_rgba(0,0,0,0.16)]'
                        >
                            <span className='whitespace-pre-line'>{quote}</span>
                        </blockquote>
                    ))}
                </div>
            </section>
        </main>
    )
}
