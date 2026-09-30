import type { CSSProperties, ReactNode } from 'react'

type DashboardPageProps = {
    children: ReactNode
    className?: string
    style?: CSSProperties
}

type DashboardHeaderProps = {
    title: string
    description?: string
    eyebrow?: string | null
    actions?: ReactNode
}

type DashboardPanelProps = {
    children: ReactNode
    className?: string
    id?: string
}

export const dashboardPanelClass = 'rounded-lg border border-ui-border bg-ui-panel shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20'

export function DashboardPage({ children, className = '', style }: DashboardPageProps) {
    return <div style={style} className={`grid min-h-full w-full content-start gap-3 px-2 py-4 text-ui-text sm:gap-4 ${className}`.trim()}>{children}</div>
}

export function DashboardHeader(props: DashboardHeaderProps) {
    void props
    return null
}

export function DashboardPanel({ children, className = '', id }: DashboardPanelProps) {
    return <section id={id} className={`${dashboardPanelClass} ${className}`.trim()}>{children}</section>
}

export function DashboardDataFallback({ label }: { label: string }) {
    return <div role='status' aria-busy='true' aria-label={`Loading ${label}`} className='grid min-h-48 content-start gap-3 rounded-xl border border-ui-border bg-ui-panel p-4'>
        <span className='h-5 w-40 animate-pulse rounded bg-ui-raised' />
        <span className='h-4 w-full max-w-2xl animate-pulse rounded bg-ui-raised' />
        <span className='h-24 w-full animate-pulse rounded-lg bg-ui-raised' />
    </div>
}
