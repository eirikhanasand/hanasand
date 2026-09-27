'use client'

import SupportAssistant from '@/components/support/supportAssistant'

// Handles invalid pages
export default function Custom404 () {
    return (
        <main className='grid min-h-app-viewport place-items-center bg-ui-canvas px-4 py-8 text-ui-text'>
            <SupportAssistant force />
            <div className='flex flex-wrap items-center justify-center gap-4 text-center'>
                <h1 className='text-3xl font-semibold text-ui-text'>404</h1>
                <span aria-hidden='true' className='hidden h-10 w-px bg-ui-border sm:block' />
                <p className='text-lg text-ui-muted'>This page could not be found.</p>
            </div>
        </main>
    )
}
