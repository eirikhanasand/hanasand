'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, AlarmClockCheck, BookOpen, BrainCircuit, CalendarClock, ClipboardList, Code2, Database, DatabaseBackup, DatabaseZap, FileCode2, FileWarning, FolderKanban, Gauge, Globe2, Inbox, LayoutDashboard, ListChecks, Network, NotebookText, PanelLeftClose, PanelLeftOpen, PlayCircle, Radar, ScanSearch, Server, Settings2, ShieldCheck, Sparkles, UserRound, UserRoundCheck, Zap } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { getDashboardViewMode, setDashboardViewMode } from '@/utils/layout/viewMode'

type Item = {
    href: string
    label: string
    icon: React.ReactNode
}

type Section = {
    title: string
    items: Item[]
}

export default function DashboardSidebar({
    id,
    isAdmin,
    canManageSystem,
    canManageContent,
}: {
    id: string
    isAdmin: boolean
    canManageSystem: boolean
    canManageContent: boolean
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

    const productItems: Item[] = [
        { href: '/dashboard', label: 'Console', icon: <LayoutDashboard className='h-4 w-4' /> },
        { href: '/ti', label: 'Threat search', icon: <Radar className='h-4 w-4' /> },
        { href: '/dashboard/dwm', label: 'Dark web', icon: <ShieldCheck className='h-4 w-4' /> },
        { href: '/developers', label: 'API docs', icon: <Code2 className='h-4 w-4' /> },
        { href: '/dashboard/subscription', label: 'Subscription', icon: <ScanSearch className='h-4 w-4' /> },
    ]

    const workspaceItems: Item[] = [
        { href: `/profile/${id}`, label: 'Profile', icon: <UserRound className='h-4 w-4' /> },
    ]

    const systemItems: Item[] = []
    const contentItems: Item[] = []
    const adminItems: Item[] = []
    const tiAdminItems: Item[] = []

    if (canManageSystem) {
        systemItems.push(
            { href: '/dashboard/vms', label: 'VMs', icon: <Server className='h-4 w-4' /> },
            { href: '/dashboard/traffic', label: 'Traffic', icon: <Network className='h-4 w-4' /> },
            { href: '/dashboard/system', label: 'System', icon: <Settings2 className='h-4 w-4' /> },
            { href: '/dashboard/system/ai', label: 'AI Metrics', icon: <Sparkles className='h-4 w-4' /> },
            { href: '/dashboard/vulnerabilities', label: 'Vulnerabilities', icon: <ScanSearch className='h-4 w-4' /> },
            { href: '/dashboard/load-testing', label: 'Load testing', icon: <Zap className='h-4 w-4' /> },
        )
    }

    if (canManageContent) {
        contentItems.push(
            { href: '/dashboard/notes', label: 'Notes', icon: <NotebookText className='h-4 w-4' /> },
            { href: '/dashboard/articles', label: 'Articles', icon: <BookOpen className='h-4 w-4' /> },
            { href: '/dashboard/thoughts', label: 'Thoughts', icon: <BrainCircuit className='h-4 w-4' /> },
        )
    }

    if (isAdmin) {
        tiAdminItems.push(
            { href: '/dashboard/ti/control', label: 'Collection', icon: <Radar className='h-4 w-4' /> },
            { href: '/dashboard/ti/workbench', label: 'Recent attacks', icon: <Inbox className='h-4 w-4' /> },
            { href: '/dashboard/ti/activity', label: 'Latest activity', icon: <Activity className='h-4 w-4' /> },
            { href: '/dashboard/ti/enrichment', label: 'Actor profiles', icon: <ListChecks className='h-4 w-4' /> },
            { href: '/dashboard/ti/sources', label: 'Sources', icon: <DatabaseZap className='h-4 w-4' /> },
            { href: '/dashboard/ti/domains', label: 'Watched entities', icon: <Globe2 className='h-4 w-4' /> },
            { href: '/dashboard/ti/runs', label: 'Collection runs', icon: <PlayCircle className='h-4 w-4' /> },
            { href: '/dashboard/ti/audit', label: 'Audit log', icon: <ClipboardList className='h-4 w-4' /> },
        )

        adminItems.push(
            { href: '/dashboard/automations', label: 'Automations', icon: <AlarmClockCheck className='h-4 w-4' /> },
            { href: '/dashboard/projects', label: 'Projects', icon: <FolderKanban className='h-4 w-4' /> },
            { href: '/dashboard/shares', label: 'Shares', icon: <FileCode2 className='h-4 w-4' /> },
            { href: '/dashboard/logs', label: 'Logs', icon: <FileWarning className='h-4 w-4' /> },
            { href: '/dashboard/mail', label: 'Mail', icon: <Inbox className='h-4 w-4' /> },
            { href: '/dashboard/db', label: 'Database', icon: <Database className='h-4 w-4' /> },
            { href: '/dashboard/db/backups', label: 'Backup', icon: <DatabaseBackup className='h-4 w-4' /> },
            { href: '/dashboard/system/rate-limits', label: 'Rate Limits', icon: <Gauge className='h-4 w-4' /> },
            { href: '/dashboard/cron-jobs', label: 'Cron Jobs', icon: <CalendarClock className='h-4 w-4' /> },
            { href: '/dashboard/system/impersonation', label: 'Impersonation', icon: <UserRoundCheck className='h-4 w-4' /> },
            { href: '/dashboard/management', label: 'Management', icon: <ShieldCheck className='h-4 w-4' /> },
        )
    }

    const compact = mode === 'compact'
    const toggleLabel = compact ? 'Expand sidebar' : 'Collapse sidebar'
    const sections: Section[] = [
        { title: 'Monitoring', items: productItems },
        { title: 'Threat monitoring', items: tiAdminItems },
        { title: 'Settings', items: workspaceItems },
        { title: 'Content', items: contentItems },
        { title: 'System', items: systemItems },
        { title: 'Admin', items: adminItems },
    ].filter(section => section.items.length)
    const items = sections.flatMap(section => section.items)
    const activeHref = items
        .filter((item) => pathname === item.href
            || (item.href === '/dashboard' && pathname === '/dashboard/overview')
            || (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`)))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href

    return (
        <aside className={`dashboard-sidebar-sticky noscroll hidden min-h-0 overflow-auto rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20 lg:block ${compact ? 'lg:w-16' : 'lg:w-58'}`}>
            <div className={`mb-2 flex items-center ${compact ? 'justify-center' : 'justify-between gap-3 px-2 py-1'}`}>
                {compact ? (
                    <button
                        type='button'
                        onClick={() => setDashboardViewMode('normal')}
                        className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-canvas hover:text-ui-text'
                        aria-label='Expand sidebar'
                        title='Expand sidebar'
                    >
                        <PanelLeftOpen className='h-4 w-4' />
                    </button>
                ) : (
                    <>
                        <div>
                            <p className='text-[0.62rem] font-semibold uppercase text-ui-primary'>Console</p>
                            <h2 className='mt-1 text-sm font-semibold text-ui-text'>Monitoring</h2>
                        </div>
                        <button
                            type='button'
                            onClick={() => setDashboardViewMode('compact')}
                            className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-canvas hover:text-ui-text'
                            aria-label={toggleLabel}
                            title={toggleLabel}
                        >
                            <PanelLeftClose className='h-4 w-4' />
                        </button>
                    </>
                )}
            </div>

            <nav className='grid gap-3'>
                {sections.map(section => (
                    <div key={section.title} className='grid gap-1'>
                        {!compact && <p className='px-2 text-[0.62rem] font-semibold uppercase text-ui-muted'>{section.title}</p>}
                        <div className='grid gap-1 sm:grid-cols-2 lg:grid-cols-1'>
                            {section.items.map((item) => {
                                const active = item.href === activeHref
                                const itemKey = `${section.title}:${item.href}:${item.label}`

                                return (
                                    <Link
                                        key={itemKey}
                                        href={item.href}
                                        title={item.label}
                                        className={`flex min-h-10 items-center rounded-lg border px-3 transition ${
                                            compact ? 'justify-center' : 'gap-3'
                                        } ${
                                            active
                                                ? 'border-ui-primary bg-ui-primary/10 text-ui-primary'
                                                : 'border-transparent text-ui-muted hover:border-ui-border hover:bg-ui-canvas hover:text-ui-text'
                                        }`}
                                    >
                                        {item.icon}
                                        {!compact && <span className='text-sm font-medium'>{item.label}</span>}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    )
}
