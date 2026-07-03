import type { ReactNode } from 'react'

type DashboardPageProps = {
    children: ReactNode
    className?: string
}

type DashboardHeaderProps = {
    title: string
    description?: string
    eyebrow?: string
    actions?: ReactNode
}

type DashboardPanelProps = {
    children: ReactNode
    className?: string
    id?: string
}

export const dashboardPanelClass = 'rounded-lg border border-ui-border bg-ui-panel shadow-sm shadow-black/10 dark:shadow-black/20'

export function DashboardPage({ children, className = '' }: DashboardPageProps) {
    return <div className={`grid min-h-full w-full content-start gap-3 p-2 text-ui-text sm:gap-4 sm:p-4 ${className}`.trim()}>{children}</div>
}

export function DashboardHeader({
    title,
    description,
    eyebrow = 'Dashboard',
    actions,
}: DashboardHeaderProps) {
    return (
        <section className='overflow-hidden pt-1'>
            <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>{eyebrow}</p>
                    <h1 className='mt-1.5 max-w-5xl text-xl font-semibold text-ui-text sm:text-2xl'>{title}</h1>
                    {description && <p className='mt-2 max-w-2xl text-sm leading-6 text-ui-muted'>{description}</p>}
                </div>
                {actions && <div className='shrink-0'>{actions}</div>}
            </div>
        </section>
    )
}

export function DashboardPanel({ children, className = '', id }: DashboardPanelProps) {
    return <section id={id} className={`${dashboardPanelClass} ${className}`.trim()}>{children}</section>
}
