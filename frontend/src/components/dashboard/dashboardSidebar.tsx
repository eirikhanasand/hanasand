'use client'

import Link from 'next/link'
import { NAVIGATION_COOKIE, readNavigationPreferences, type NavigationPreferences as Preferences } from '@/utils/layout/navigationPreferences'
import { getCookie, setCookie } from '@/utils/cookies/cookies'
import { usePathname } from 'next/navigation'
import { AlarmClockCheck, ChevronDown, ChevronsUp, FolderKanban, NotebookText, PanelLeftClose, PanelLeftOpen, Pin, Radar, Search, Server, Settings2, ShieldCheck } from 'lucide-react'
import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { getDashboardViewMode, setDashboardViewMode } from '@/utils/layout/viewMode'
import { getDashboardNavigation, navigationLinks, type NavigationAccess, type NavigationItem } from '@/utils/layout/dashboardNavigation'

const sectionIcons: Record<string, typeof ShieldCheck> = {
    'Security operations': ShieldCheck,
    'Threat intelligence': Radar,
    Automation: AlarmClockCheck,
    Infrastructure: Server,
    Content: NotebookText,
    Administration: FolderKanban,
    Settings: Settings2,
    Pinned: Pin,
}

export default function DashboardSidebar({ initialPreferences = { expanded: {}, pinned: [] }, initialMode = 'normal', ...access }: NavigationAccess & { initialPreferences?: Preferences, initialMode?: 'normal' | 'compact' }) {
    const pathname = usePathname()
    const domId = useId()
    const storageKey = `dashboard-navigation:v1:${access.id}`
    const [preferences, setPreferences] = useState<Preferences>(initialPreferences)
    const [query, setQuery] = useState('')
    const mode = useSyncExternalStore(
        (onChange) => {
            window.addEventListener('dashboard-view-mode', onChange)
            return () => window.removeEventListener('dashboard-view-mode', onChange)
        },
        () => getDashboardViewMode(),
        () => initialMode,
    )
    const compact = mode === 'compact'
    const sections = getDashboardNavigation(access)
    const links = navigationLinks(sections)
    const route = pathname === '/dwm' ? '/dwm/cases' : pathname
    const active = links.filter(item => route === item.href || route.startsWith(`${item.href}/`))
        .sort((left, right) => right.href.length - left.href.length)[0]
    const activePath = active?.ancestors.join('/') ?? (pathname.startsWith('/automation') ? 'Automation' : '')

    useEffect(() => {
        let saved = readNavigationPreferences(getCookie(NAVIGATION_COOKIE) || undefined, access.id)
        try {
            if (!getCookie(NAVIGATION_COOKIE)) {
                const legacy = JSON.parse(localStorage.getItem(storageKey) || '{}')
                saved = readNavigationPreferences(JSON.stringify({ ...legacy, id: access.id }), access.id)
            }
        } catch { /* Preferences are optional. */ }
        save(saved)
        setQuery('')
    }, [storageKey, pathname, activePath])

    function save(next: Preferences) {
        setPreferences(next)
        try { setCookie(NAVIGATION_COOKIE, JSON.stringify({ ...next, id: access.id }), 365); localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* Keep this session usable without storage. */ }
    }

    function toggle(key: string) {
        save({ ...preferences, expanded: { ...preferences.expanded, [key]: !(preferences.expanded[key] ?? (activePath === key || activePath.startsWith(`${key}/`))) } })
    }

    function collapseAll() {
        const keys = [
            ...Object.keys(preferences.expanded),
            'Pinned',
            ...links.flatMap(item => item.ancestors.map((_, index) => item.ancestors.slice(0, index + 1).join('/'))),
        ]
        save({ ...preferences, expanded: Object.fromEntries(keys.map(key => [key, false])) })
        setQuery('')
    }

    function pin(href: string) {
        save({ ...preferences, expanded: { ...preferences.expanded, Pinned: true }, pinned: preferences.pinned.includes(href) ? preferences.pinned.filter(item => item !== href) : [...preferences.pinned, href] })
    }

    function renderLink(item: { label: string, href: string }, key = item.href) {
        const pinned = preferences.pinned.includes(item.href)
        return (
            <div key={key} className='group flex min-w-0 items-center rounded-md hover:bg-ui-canvas'>
                <Link href={item.href} aria-current={active?.href === item.href ? 'page' : undefined}
                    className={`min-w-0 flex-1 rounded-md px-2 py-2 text-sm leading-5 focus-visible:outline-2 focus-visible:outline-ui-primary ${active?.href === item.href ? 'bg-ui-primary/10 font-semibold text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}>
                    {item.label}
                </Link>
                <button type='button' onClick={() => pin(item.href)} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${item.label}`} aria-pressed={pinned}
                    className={`grid h-8 w-7 shrink-0 place-items-center rounded text-ui-muted hover:text-ui-primary focus-visible:outline-2 focus-visible:outline-ui-primary ${pinned ? 'text-ui-primary' : 'lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100'}`}>
                    <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} />
                </button>
            </div>
        )
    }

    function renderGroup(item: NavigationItem, ancestors: string[] = []) {
        const path = [...ancestors, item.label]
        const key = path.join('/')
        const containsActive = activePath === key || activePath.startsWith(`${key}/`)
        const expanded = preferences.expanded[key] ?? containsActive
        const Icon = sectionIcons[item.label] || FolderKanban
        const controls = `${domId}-${encodeURIComponent(key)}`
        return (
            <div key={key} className={ancestors.length ? 'min-w-0' : 'min-w-0 border-t border-ui-border/50 pt-1 first:border-0'}>
                <button type='button' aria-expanded={expanded} aria-controls={controls} onClick={() => toggle(key)}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm leading-5 hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary ${containsActive ? 'text-ui-primary' : 'text-ui-text'} ${ancestors.length ? 'font-medium' : 'font-semibold'}`}>
                    {!ancestors.length && <Icon className='h-4 w-4 shrink-0' />}
                    <span className='min-w-0 flex-1'>{item.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                </button>
                <div id={controls} hidden={!expanded} className='ml-2 border-l border-ui-border pl-2'>
                    {item.items?.map(child => child.items ? renderGroup(child, path) : child.href ? renderLink({ label: child.label, href: child.href }) : null)}
                </div>
            </div>
        )
    }

    const favorites = links.filter(item => preferences.pinned.includes(item.href))
        .sort((left, right) => preferences.pinned.indexOf(left.href) - preferences.pinned.indexOf(right.href))
    const search = query.trim().toLocaleLowerCase()
    const matches = search ? links.filter(item => [...item.ancestors, item.label].join(' ').toLocaleLowerCase().includes(search)) : []

    return (
        <aside aria-label='Dashboard sidebar' className={`dashboard-sidebar-sticky noscroll min-h-0 w-full overflow-auto rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20 ${compact ? 'lg:w-16' : 'lg:w-58'}`}>
            <div className={`mb-2 flex items-center ${compact ? 'justify-center' : 'justify-between px-2'}`}>
                {!compact && <h2 className='text-sm font-semibold text-ui-text'>Workspace</h2>}
                <div className='flex shrink-0 items-center'>
                    {!compact && <button type='button' onClick={collapseAll} aria-label='Collapse all menus' title='Collapse all menus'
                        className='grid h-10 w-10 place-items-center rounded-lg text-ui-muted hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary'>
                        <ChevronsUp aria-hidden='true' className='h-4 w-4' />
                    </button>}
                    <button type='button' onClick={() => setDashboardViewMode(compact ? 'normal' : 'compact')} aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
                        className='grid h-10 w-10 place-items-center rounded-lg text-ui-muted hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary'>
                        {compact ? <PanelLeftOpen className='h-4 w-4' /> : <PanelLeftClose className='h-4 w-4' />}
                    </button>
                </div>
            </div>
            {!compact && <div className='relative mb-2'>
                <Search aria-hidden='true' className='pointer-events-none absolute left-2 top-3 h-4 w-4 text-ui-muted' />
                <input type='search' aria-label='Search navigation' placeholder='Find a page…' value={query} onChange={event => setQuery(event.target.value)}
                    className='h-10 w-full min-w-0 rounded-md border border-ui-border bg-ui-canvas pl-8 pr-2 text-sm text-ui-text placeholder:text-ui-muted focus-visible:outline-2 focus-visible:outline-ui-primary' />
            </div>}
            <nav aria-label='Main navigation' className='grid gap-1'>
                {compact ? sections.map(section => {
                    const Icon = sectionIcons[section.label] || FolderKanban
                    return <button key={section.label} type='button' aria-label={`Open ${section.label}`} title={section.label}
                        onClick={() => { save({ ...preferences, expanded: { ...preferences.expanded, [section.label]: true } }); setDashboardViewMode('normal') }}
                        className={`grid h-10 w-full place-items-center rounded-md hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-ui-primary ${activePath.startsWith(section.label) ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted'}`}>
                        <Icon className='h-4 w-4' />
                    </button>
                }) : search ? <div aria-label='Navigation search results'>
                    <p role='status' className='px-2 py-1 text-xs text-ui-muted'>{matches.length} matching pages</p>
                    {matches.map(item => <div key={item.href} className='mb-2'>
                        <p className='px-2 text-[10px] text-ui-muted'>{item.ancestors.join(' › ')}</p>
                        {renderLink(item)}
                    </div>)}
                </div> : <>
                    {favorites.length > 0 && renderGroup({ label: 'Pinned', items: favorites })}
                    {sections.map(section => renderGroup(section))}
                </>}
            </nav>
        </aside>
    )
}
