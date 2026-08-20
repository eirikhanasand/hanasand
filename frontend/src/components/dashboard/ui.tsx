import type { ReactNode } from 'react'

type DashboardPageProps = {
    children: ReactNode
    className?: string
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

export function DashboardPage({ children, className = '' }: DashboardPageProps) {
    return <div className={`grid min-h-full w-full content-start gap-3 p-2 text-ui-text sm:gap-4 sm:p-4 ${className}`.trim()}>{children}</div>
}

export function DashboardHeader(props: DashboardHeaderProps) {
    void props
    return null
}

export function DashboardPanel({ children, className = '', id }: DashboardPanelProps) {
    return <section id={id} className={`${dashboardPanelClass} ${className}`.trim()}>{children}</section>
}
