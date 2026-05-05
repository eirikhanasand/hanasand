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
}

export const dashboardPanelClass = 'rounded-xl border border-bright/10 bg-background/82 shadow-[0_20px_60px_rgba(0,0,0,0.16)] backdrop-blur-md'

export function DashboardPage({ children, className = '' }: DashboardPageProps) {
    return <div className={`grid min-h-full w-full gap-3 p-2 sm:gap-4 sm:p-4 ${className}`.trim()}>{children}</div>
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
                    <p className='text-[10px] font-semibold uppercase tracking-[0.28em] text-bright/32'>{eyebrow}</p>
                    <h1 className='mt-1.5 max-w-5xl text-xl font-semibold text-bright sm:text-2xl'>{title}</h1>
                    {description && <p className='mt-2 max-w-2xl text-sm leading-6 text-bright/48'>{description}</p>}
                </div>
                {actions && <div className='shrink-0'>{actions}</div>}
            </div>
        </section>
    )
}

export function DashboardPanel({ children, className = '' }: DashboardPanelProps) {
    return <section className={`${dashboardPanelClass} ${className}`.trim()}>{children}</section>
}
