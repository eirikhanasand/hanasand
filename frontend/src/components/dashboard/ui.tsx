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

export const dashboardPanelClass = 'rounded-[1.6rem] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl'

export function DashboardPage({ children, className = '' }: DashboardPageProps) {
    return <div className={`mx-auto grid w-full max-w-[1320px] gap-4 py-4 md:py-6 ${className}`.trim()}>{children}</div>
}

export function DashboardHeader({
    title,
    description,
    eyebrow = 'Dashboard',
    actions,
}: DashboardHeaderProps) {
    return (
        <section className={`${dashboardPanelClass} overflow-hidden px-5 py-5 md:px-6`}>
            <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
                <div className='min-w-0'>
                    <p className='text-[11px] uppercase tracking-[0.28em] text-bright/35'>{eyebrow}</p>
                    <h1 className='mt-2 text-2xl font-semibold tracking-[-0.04em] text-bright md:text-3xl'>{title}</h1>
                    {description && (
                        <p className='mt-2 max-w-3xl text-sm leading-6 text-bright/52'>{description}</p>
                    )}
                </div>
                {actions && <div className='shrink-0'>{actions}</div>}
            </div>
        </section>
    )
}

export function DashboardPanel({ children, className = '' }: DashboardPanelProps) {
    return <section className={`${dashboardPanelClass} ${className}`.trim()}>{children}</section>
}
