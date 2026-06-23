import type { Metadata } from 'next'
import Link from 'next/link'
import quotes from '../../quotes/quotes.json'
import { buildRouteMetadata } from '../../seo'
import './page.css'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Motivation',
    description: 'The restored Hanasand motivation wall: a slow-scrolling personal quote wall.',
    path: '/eirik/motivation',
    keywords: ['motivation quotes', 'eirik hanasand', 'personal notebook', 'quote wall'],
})

export default function MotivationPage() {
    const uniqueQuotes = Array.from(new Set(Array.isArray(quotes) ? quotes : []))
    const shuffledQuotes = shuffleArray(uniqueQuotes)
    const wallQuotes = shuffledQuotes.concat(shuffledQuotes).concat(shuffledQuotes)

    return (
        <main className='relative max-h-[calc(100vh-4.5rem)] min-h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-[#f7f8fb] text-[#171a21]'>
            <div className='pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-[#f7f8fb] via-[#f7f8fb]/90 to-transparent' />
            <div className='pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-[#f7f8fb] via-[#f7f8fb]/90 to-transparent' />

            <div className='absolute left-4 top-4 z-20 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-lg border border-[#dfe5ee] bg-white/90 px-3 py-2 text-xs text-[#667085] shadow-sm backdrop-blur-md md:left-8 md:top-8'>
                <Link href='/eirik' className='font-semibold text-[#3056d3] transition hover:text-[#1f3ea8]'>Eirik</Link>
                <span className='text-[#b4bdca]'>/</span>
                <span>motivation wall</span>
                <span className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-2 py-0.5 text-[#667085]'>{uniqueQuotes.length} quotes</span>
            </div>

            <div className='eirik-quote-wall grid px-4 py-24 sm:grid-cols-2 md:grid-cols-4 md:px-8'>
                {wallQuotes.map((quote, index) => (
                    <div
                        key={`${index}-${quote.slice(0, 32)}`}
                        className='mx-auto grid min-h-24 w-full max-w-44 place-items-center rounded-lg border border-[#dfe5ee] bg-white px-4 text-center text-[11px] font-medium leading-5 text-[#344054] shadow-sm'
                    >
                        <p>{quote}</p>
                    </div>
                ))}
            </div>
        </main>
    )
}

function shuffleArray(array: string[]) {
    return [...array].sort(() => Math.random() - 0.5)
}
