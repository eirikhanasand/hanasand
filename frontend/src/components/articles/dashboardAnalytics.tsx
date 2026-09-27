'use client'

import { ChartNoAxesCombined } from 'lucide-react'
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

const ArticleAnalyticsContext = createContext<[boolean, Dispatch<SetStateAction<boolean>>] | null>(null)

export function ArticleAnalyticsProvider({ children }: { children: ReactNode }) {
    const state = useState(false)

    return <ArticleAnalyticsContext.Provider value={state}>{children}</ArticleAnalyticsContext.Provider>
}

export function ArticleAnalyticsToggle() {
    const [open, setOpen] = useArticleAnalyticsState()

    return (
        <button
            type='button'
            aria-label={open ? 'Hide article analytics' : 'Show article analytics'}
            aria-expanded={open}
            aria-controls='article-analytics'
            title='Analytics'
            onClick={() => setOpen(value => !value)}
            className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary'
        >
            <ChartNoAxesCombined className='h-4 w-4' />
        </button>
    )
}

export function ArticleAnalyticsPanel({ children }: { children: ReactNode }) {
    const [open] = useArticleAnalyticsState()

    if (!open) return null

    return <section id='article-analytics' aria-label='Article analytics' className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>{children}</section>
}

function useArticleAnalyticsState() {
    const state = useContext(ArticleAnalyticsContext)
    if (!state) throw new Error('Article analytics components need an ArticleAnalyticsProvider.')
    return state
}
