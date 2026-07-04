'use client'

import { usePathname } from 'next/navigation'
import ShareIcon from '@/components/menu/shareIcon'
import ThemeSwitch from '@/components/theme/themeSwitch'
import { ActivityIcon, BellRing, BookOpen, ChevronDown, Code2, Gauge, LockKeyhole, MenuIcon, Network, Radar, Search, ShieldCheck, Waypoints, X } from 'lucide-react'
import Login from '@/components/login/login'
import Logout from '@/components/logout/logout'
import Dashboard from '@/components/dashboard/dashboard'
import Menu from '@/components/menu/menu'
import Link from 'next/link'
import ViewModeToggle from './viewModeToggle'
import isSharePath from '@/utils/routes/isSharePath'
import isPublicProductPath from '@/utils/routes/isPublicProductPath'
import BrandLogo from '@/components/brand/brandLogo'
import { useState } from 'react'

const productItems = [
    { title: 'Organizations', detail: 'Manage members, shared watchlists, alert scope, and destinations.', href: '/organizations', icon: ShieldCheck },
    { title: 'Dark Web Monitoring', detail: 'Watch companies, vendors, domains, and brands for reviewable exposure alerts.', href: '/solutions/dwm', icon: BellRing },
    { title: 'Threat Intelligence', detail: 'Search companies, actors, claims, sources, and alert context.', href: '/ti', icon: Radar },
    { title: 'Actor Overview', detail: 'Actor profiles, victim pivots, and review-ready timelines.', href: '/ti', icon: Waypoints },
    { title: 'API and Webhooks', detail: 'Route reviewed alert fields into customer tools and analyst workflows.', href: '/developers', icon: Code2 },
]

const solutionItems = [
    { title: 'All Solutions', detail: 'Company exposure monitoring, API delivery, and review workflows.', href: '/solutions', icon: ShieldCheck },
    { title: 'Dark Web Monitoring', detail: 'Company and vendor alerts from watched exposure sources.', href: '/solutions/dwm', icon: BellRing },
    { title: 'Threat Search', detail: 'Open the public intelligence workspace for companies and actors.', href: '/ti', icon: Radar },
    { title: 'Onion Sessions', detail: 'Controlled source review for approved investigation scopes.', href: '/solutions/onion-session', icon: Network },
]

const resourceItems = [
    { title: 'Trust Center', detail: 'Security, DPA, SLA, subprocessors, and enterprise review path.', href: '/trust', icon: ShieldCheck },
    { title: 'Status', detail: 'Service health and current uptime.', href: '/status', icon: ActivityIcon },
    { title: 'Service Checks', detail: 'Permitted endpoint checks for URLs you control.', href: '/test', icon: Gauge },
    { title: 'Bloom Hash Exposure Lookup', detail: 'Check a SHA-1 hash through a prefix-only exposure lookup.', href: '/pwned', icon: LockKeyhole },
    { title: 'Company', detail: 'Product notes, ownership, and current Hanasand direction.', href: '/about', icon: BookOpen },
]

function PublicDropdown({ label, items }: { label: string, items: Array<{ title: string, detail: string, href: string, icon: typeof Radar }> }) {
    return (
        <div className='group relative'>
            <button className='inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text group-hover:bg-ui-raised' aria-haspopup='true'>
                {label}
                <ChevronDown className='h-4 w-4 text-ui-muted' />
            </button>
            <div className='invisible pointer-events-none absolute left-0 top-10 z-10 h-3 w-[23rem] group-hover:visible group-hover:pointer-events-auto group-focus-within:visible group-focus-within:pointer-events-auto' aria-hidden='true' />
            <div className='invisible pointer-events-none absolute left-0 top-12 z-20 w-[23rem] translate-y-1 rounded-lg border border-ui-border bg-ui-panel p-2 opacity-0 shadow-[0_22px_70px_rgba(25,34,52,0.15)] transition group-hover:visible group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:shadow-[0_22px_70px_rgba(0,0,0,0.42)]'>
                {items.map((item) => {
                    const Icon = item.icon
                    return (
                        <Link key={item.title} href={item.href} className='grid grid-cols-[2.5rem_1fr] gap-3 rounded-lg p-3 transition hover:bg-ui-raised'>
                            <span className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                <Icon className='h-4.5 w-4.5' />
                            </span>
                            <span className='grid gap-0.5'>
                                <span className='text-sm font-semibold text-ui-text'>{item.title}</span>
                                <span className='text-xs leading-5 text-ui-muted'>{item.detail}</span>
                            </span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

const mobilePublicLinks = [
    { label: 'Organizations', href: '/organizations' },
    { label: 'Dark web monitoring', href: '/solutions/dwm' },
    { label: 'Threat search', href: '/ti' },
    { label: 'Solutions', href: '/solutions' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Trust center', href: '/trust' },
    { label: 'Developers', href: '/developers' },
    { label: 'Onion sessions', href: '/solutions/onion-session' },
    { label: 'Bloom hash lookup', href: '/pwned' },
    { label: 'Status', href: '/status' },
    { label: 'Service checks', href: '/test' },
    { label: 'Support', href: '/support' },
]

function PublicMobileMenu({ token }: { token: boolean }) {
    const [open, setOpen] = useState(false)
    const links = token
        ? mobilePublicLinks.map(item => {
            if (item.href === '/solutions/dwm') return { ...item, href: '/dashboard/dwm' }
            if (item.href === '/pricing') return { ...item, href: '/dashboard/subscription' }
            return item
        })
        : mobilePublicLinks

    return (
        <div className='relative lg:hidden'>
            <button
                type='button'
                onClick={() => setOpen((next) => !next)}
                className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                aria-label={open ? 'Close navigation' : 'Open navigation'}
                aria-expanded={open}
            >
                {open ? <X className='h-5 w-5' /> : <MenuIcon className='h-5 w-5' />}
            </button>
            {open && (
                <div className='absolute right-0 top-13 z-30 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-2 shadow-[0_22px_70px_rgba(25,34,52,0.16)] dark:shadow-[0_22px_70px_rgba(0,0,0,0.42)]'>
                    {links.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className='flex h-11 items-center justify-between rounded-lg px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised'
                        >
                            {item.label}
                            <ChevronDown className='h-4 w-4 -rotate-90 text-ui-muted' />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function Header({ token, path: serverPath }: { token: boolean, path: string }) {
    const baseStyles = 'group grid h-10 w-10 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
    const pathname = usePathname() || serverPath
    const isStatus = pathname.includes('/status')
    const isShare = isSharePath(pathname)
    const isAI = pathname.endsWith('/ai') || pathname.includes('/ai/')
    const isDashboard = pathname.startsWith('/dashboard')
    const isProfile = pathname.startsWith('/profile')
    const isPublicProduct = isPublicProductPath(pathname)
    const isLoggedInConsoleProduct = token && (pathname === '/ti' || pathname.startsWith('/ti/'))
    const isOrganizations = pathname.startsWith('/organizations')
    const isAppSurface = isLoggedInConsoleProduct || (!isPublicProduct && (isShare || isAI || isDashboard || isProfile || isOrganizations))
    const darkWebHref = token ? '/dashboard/dwm' : '/solutions/dwm'
    const pricingHref = token ? '/dashboard/subscription' : '/pricing'

    if (!isAppSurface) {
        return (
            <header className='fixed left-0 top-0 z-1000 w-full border-b border-ui-border bg-ui-panel px-3 sm:px-5 md:px-10 lg:px-16'>
                <div className='mx-auto flex h-18 w-full max-w-7xl items-center justify-between gap-5'>
                    <BrandLogo />

                    <nav className='hidden items-center gap-5 lg:flex'>
                        <PublicDropdown label='Product' items={productItems} />
                        <PublicDropdown label='Solutions' items={token ? solutionItems.map(item => item.href === '/solutions/dwm' ? { ...item, href: '/dashboard/dwm' } : item) : solutionItems} />
                        <Link href='/developers' className='inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>
                            Developers
                            <Code2 className='h-4 w-4 text-ui-muted' />
                        </Link>
                        <PublicDropdown label='Resources' items={resourceItems} />
                        <Link href={pricingHref} className='inline-flex h-10 min-w-20 items-center justify-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>Pricing</Link>
                    </nav>

                    <div className='flex items-center justify-end gap-2'>
                        <ThemeSwitch />
                        <Link href='/support' className='hidden h-10 min-w-20 items-center justify-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text md:inline-flex'>Support</Link>
                        <Link href={token ? '/dashboard/overview' : '/login'} className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:opacity-90'>
                            Go to Console
                        </Link>
                        <Link href='/ti' aria-label='Search intelligence' className='hidden h-11 w-11 place-items-center rounded-lg border border-ui-border text-ui-muted transition hover:bg-ui-raised hover:text-ui-text sm:grid lg:hidden'>
                            <Search className='h-5 w-5' />
                        </Link>
                        <PublicMobileMenu token={token} />
                    </div>
                </div>
            </header>
        )
    }

    return (
        <header className='fixed left-0 top-0 z-1000 w-full border-b border-ui-border bg-ui-panel/95 px-3 shadow-[0_1px_0_rgba(17,24,39,0.03)] backdrop-blur sm:px-5 md:px-8'>
            <div className='mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4'>
                <div className='flex min-w-0 items-center gap-4'>
                    <BrandLogo />
                    {!isDashboard && !isProfile && !isOrganizations && (
                        <nav className='hidden items-center gap-1 lg:flex'>
                            {token ? (
                                <Link href='/dashboard' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>Console</Link>
                            ) : null}
                            <Link href='/ti' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>Threat search</Link>
                            <Link href='/solutions/onion-session' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>Onion sessions</Link>
                            <Link href={darkWebHref} className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>Dark web</Link>
                            <Link href='/developers' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>API docs</Link>
                            <Link href={pricingHref} className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>Pricing</Link>
                        </nav>
                    )}
                </div>
                <div className='flex items-center justify-end gap-2'>
                    {token && isDashboard && <ViewModeToggle />}
                    {isShare ? <ShareIcon baseStyles={baseStyles} isShare={isShare} href='/s' /> : null}
                    <Link href='/status' aria-label='Status' title='Status' className={`${baseStyles} hidden sm:grid`}>
                        <ActivityIcon className={`h-4.5 w-4.5 ${isStatus ? 'text-ui-success' : ''}`} />
                    </Link>
                    <ThemeSwitch />
                    <Dashboard href='/dashboard' serverToken={token} />
                    <Logout baseStyles={baseStyles} serverToken={token} />
                    <Login serverToken={token} />
                    <Menu />
                </div>
            </div>
        </header>
    )
}
