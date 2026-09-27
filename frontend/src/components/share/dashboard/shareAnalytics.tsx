'use client'

import { ChartNoAxesCombined } from 'lucide-react'
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

const ShareAnalyticsContext = createContext<[boolean, Dispatch<SetStateAction<boolean>>] | null>(null)

export function ShareAnalyticsProvider({ children }: { children: ReactNode }) {
    const state = useState(false)

    return <ShareAnalyticsContext.Provider value={state}>{children}</ShareAnalyticsContext.Provider>
}

export function ShareAnalyticsToggle() {
    const state = useShareAnalyticsState()
    const [open, setOpen] = state

    return (
        <button
            type='button'
            aria-label={open ? 'Hide share analytics' : 'Show share analytics'}
            aria-expanded={open}
            aria-controls='share-statistics'
            title='Analytics'
            onClick={() => setOpen(value => !value)}
            className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary'
        >
            <ChartNoAxesCombined className='h-4 w-4' />
        </button>
    )
}

export function ShareAnalyticsPanel({ children }: { children: ReactNode }) {
    const [open] = useShareAnalyticsState()

    if (!open) return null

    return <section id='share-statistics' aria-label='Share statistics' className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>{children}</section>
}

function useShareAnalyticsState() {
    const state = useContext(ShareAnalyticsContext)
    if (!state) throw new Error('Share analytics components need a ShareAnalyticsProvider.')
    return state
}
