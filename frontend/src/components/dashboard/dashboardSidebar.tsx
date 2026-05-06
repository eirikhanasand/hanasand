'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlarmClockCheck, BrainCircuit, CalendarClock, Database, DatabaseBackup, FileWarning, Gauge, Inbox, LayoutDashboard, Network, NotebookText, ScanSearch, ScrollText, Settings2, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { getDashboardViewMode } from '@/utils/layout/viewMode'

type Item = {
    href: string
    label: string
    icon: React.ReactNode
}

export default function DashboardSidebar({
    id,
    isAdmin,
}: {
    id: string
    isAdmin: boolean
}) {
    const pathname = usePathname()
    const mode = useSyncExternalStore(
        (onStoreChange) => {
            function handleModeChange() {
                onStoreChange()
            }

            window.addEventListener('dashboard-view-mode', handleModeChange)
            return () => window.removeEventListener('dashboard-view-mode', handleModeChange)
        },
        () => getDashboardViewMode(),
        () => 'normal'
    )

    const items: Item[] = [
        { href: '/dashboard', label: 'Overview', icon: <LayoutDashboard className='h-4 w-4' /> },
        { href: '/dashboard/mail', label: 'Mail', icon: <Inbox className='h-4 w-4' /> },
        { href: '/dashboard/automations', label: 'Automations', icon: <AlarmClockCheck className='h-4 w-4' /> },
        { href: '/dashboard/traffic', label: 'Traffic', icon: <Network className='h-4 w-4' /> },
        { href: '/dashboard/notes', label: 'Notes', icon: <NotebookText className='h-4 w-4' /> },
        { href: '/dashboard/system', label: 'System', icon: <Settings2 className='h-4 w-4' /> },
        { href: '/dashboard/system/ai', label: 'AI Metrics', icon: <Sparkles className='h-4 w-4' /> },
        { href: '/dashboard/vulnerabilities', label: 'Vulnerabilities', icon: <ScanSearch className='h-4 w-4' /> },
        { href: '/dashboard/articles', label: 'Articles', icon: <ScrollText className='h-4 w-4' /> },
        { href: '/dashboard/thoughts', label: 'Thoughts', icon: <BrainCircuit className='h-4 w-4' /> },
        { href: `/profile/${id}`, label: 'Profile', icon: <UserRound className='h-4 w-4' /> },
    ]

    if (isAdmin) {
        items.splice(4, 0, { href: '/dashboard/logs', label: 'Logs', icon: <FileWarning className='h-4 w-4' /> })
        items.splice(5, 0, { href: '/dashboard/db', label: 'Database', icon: <Database className='h-4 w-4' /> })
        items.splice(6, 0, { href: '/dashboard/db/backups', label: 'Backup', icon: <DatabaseBackup className='h-4 w-4' /> })
        items.splice(8, 0, { href: '/dashboard/system/rate-limits', label: 'Rate Limits', icon: <Gauge className='h-4 w-4' /> })
        items.splice(9, 0, { href: '/dashboard/system/cron', label: 'Cron Jobs', icon: <CalendarClock className='h-4 w-4' /> })
        items.push({ href: '/dashboard/management', label: 'Management', icon: <ShieldCheck className='h-4 w-4' /> })
    }

    const compact = mode === 'compact'

    return (
        <aside className={`dashboard-sidebar-sticky h-fit max-h-full overflow-auto rounded-xl border border-white/10 bg-background/82 p-2 backdrop-blur-md ${compact ? 'lg:w-16' : 'lg:w-58'}`}>
            <div className={`mb-2 flex items-center ${compact ? 'justify-center' : 'justify-between gap-3 px-2 py-1'}`}>
                {compact ? (
                    <LayoutDashboard className='h-4 w-4 text-bright/70' />
                ) : (
                    <>
                        <div>
                            <p className='text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-bright/32'>Workspace</p>
                            <h2 className='mt-1 text-sm font-semibold text-bright/86'>Dashboard</h2>
                        </div>
                        <LayoutDashboard className='h-4 w-4 text-bright/55' />
                    </>
                )}
            </div>

            <nav className='grid gap-1 sm:grid-cols-2 lg:grid-cols-1'>
                {items.map((item) => {
                    const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`))

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            className={`flex min-h-10 items-center rounded-lg border px-3 transition ${
                                compact ? 'justify-center' : 'gap-3'
                            } ${
                                active
                                    ? 'border-white/12 bg-white/10 text-bright'
                                    : 'border-transparent text-bright/52 hover:border-white/8 hover:bg-white/6 hover:text-bright/82'
                            }`}
                        >
                            {item.icon}
                            {!compact && <span className='text-sm font-medium'>{item.label}</span>}
                        </Link>
                    )
                })}
            </nav>
        </aside>
    )
}
