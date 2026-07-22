'use client'

import { useState } from 'react'
import AutomaticReviewQueue from './automaticReviewQueue'
import ClaimReviewClient from './claimReviewClient'

export default function ReviewWorkspace() {
    const [view, setView] = useState<'automatic' | 'manual'>('automatic')

    return (
        <div className='grid gap-3'>
            <div className='inline-flex w-fit rounded-md border border-ui-border bg-ui-panel p-1' aria-label='Review workflow'>
                <button type='button' onClick={() => setView('automatic')} className={`h-8 rounded px-3 text-xs font-semibold ${view === 'automatic' ? 'bg-ui-primary text-ui-canvas' : 'text-ui-muted hover:text-ui-text'}`}>Automatic queue</button>
                <button type='button' onClick={() => setView('manual')} className={`h-8 rounded px-3 text-xs font-semibold ${view === 'manual' ? 'bg-ui-primary text-ui-canvas' : 'text-ui-muted hover:text-ui-text'}`}>Manual review</button>
            </div>
            {view === 'automatic' ? <AutomaticReviewQueue /> : <ClaimReviewClient />}
        </div>
    )
}
