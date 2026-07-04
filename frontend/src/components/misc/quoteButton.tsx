import Link from 'next/link'

export default function QuoteButton() {
    return (
        <Link href='/quotes' className='absolute bottom-10 left-10 cursor-pointer rounded-lg border border-ui-border bg-ui-panel px-4 py-1 text-center text-ui-text shadow-sm transition hover:bg-ui-raised'>
            <h2 className='text-2xs'>Quotes</h2>
        </Link>
    )
}
