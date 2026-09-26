'use client'

import { ChartNoAxesCombined } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export default function ShareAnalytics({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false)

    return (
        <div className='relative'>
            <button
                type='button'
                aria-label={open ? 'Hide share analytics' : 'Show share analytics'}
                aria-expanded={open}
                title='Analytics'
                onClick={() => setOpen(value => !value)}
                className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary'
            >
                <ChartNoAxesCombined className='h-4 w-4' />
            </button>
            {open && <div className='absolute right-0 top-full z-20 mt-2 w-[90vw] max-w-4xl rounded-xl border border-ui-border bg-ui-canvas p-3 shadow-2xl'>{children}</div>}
        </div>
    )
}
