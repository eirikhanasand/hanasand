'use client'

import Link from 'next/link'
import { RefreshCcw } from 'lucide-react'

export default function ContentPageError({ title, reset }: { title: string, reset: () => void }) {
    return (
        <main className='mx-auto grid min-h-[50vh] w-full max-w-4xl content-center gap-4 px-4 py-12 text-ui-text md:px-8'>
            <h1 className='text-2xl font-semibold'>{title} could not be loaded.</h1>
            <p className='text-sm text-ui-muted'>The content service did not respond. Try again in a moment.</p>
            <div className='flex flex-wrap gap-3'>
                <button type='button' onClick={reset} className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas'>
                    <RefreshCcw className='h-4 w-4' /> Try again
                </button>
                <Link href='/dashboard' className='inline-flex h-10 items-center rounded-lg border border-ui-border bg-ui-panel px-4 text-sm font-semibold'>Dashboard</Link>
            </div>
        </main>
    )
}
