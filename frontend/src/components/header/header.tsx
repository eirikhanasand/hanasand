'use client'

import { usePathname } from 'next/navigation'
import ShareIcon from '@/components/menu/shareIcon'
import ThemeSwitch from '@/components/theme/themeSwitch'
import { ActivityIcon, BellRing, BookOpen, ChevronDown, Code2, LockKeyhole, Radar, Search, ShieldCheck, Waypoints } from 'lucide-react'
import Login from '@/components/login/login'
import Logout from '@/components/logout/logout'
import Dashboard from '@/components/dashboard/dashboard'
import Menu from '@/components/menu/menu'
import Link from 'next/link'
import ViewModeToggle from './viewModeToggle'
import isSharePath from '@/utils/routes/isSharePath'
import isPublicProductPath from '@/utils/routes/isPublicProductPath'
import BrandLogo from '@/components/brand/brandLogo'

const productItems = [
    { title: 'Threat Intelligence', detail: 'Search companies, actors, claims, and alert context.', href: '/ti', icon: Radar },
    { title: 'Dark Web Monitoring', detail: 'Webhook-ready company and vendor alerts from monitored actor pages.', href: '/solutions/dwm', icon: BellRing },
    { title: 'Actor Overview', detail: 'Actor profiles, victim pivots, and review-ready timelines.', href: '/ti', icon: Waypoints },
]

const solutionItems = [
    { title: 'All Solutions', detail: 'Monitoring, API delivery, and private exposure checking.', href: '/solutions', icon: ShieldCheck },
    { title: 'Dark Web Monitoring', detail: 'High-speed exposure notifications for watched companies.', href: '/solutions/dwm', icon: BellRing },
    { title: 'Bloom Filter', detail: 'Private breach and password exposure checks.', href: '/pwned', icon: LockKeyhole },
]

const resourceItems = [
    { title: 'Status', detail: 'Service health and current uptime.', href: '/status', icon: ActivityIcon },
    { title: 'Company', detail: 'Product notes, ownership, and current Hanasand direction.', href: '/about', icon: BookOpen },
]

function PublicDropdown({ label, items }: { label: string, items: Array<{ title: string, detail: string, href: string, icon: typeof Radar }> }) {
    return (
        <div className='group relative'>
            <button className='inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[#3a404b] transition hover:bg-[#f1f4f8] hover:text-[#16181d] group-hover:bg-[#f1f4f8] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white dark:group-hover:bg-white/8' aria-haspopup='true'>
                {label}
                <ChevronDown className='h-4 w-4 text-[#7a8493]' />
            </button>
            <div className='invisible pointer-events-none absolute left-0 top-10 z-10 h-3 w-[23rem] group-hover:visible group-hover:pointer-events-auto group-focus-within:visible group-focus-within:pointer-events-auto' aria-hidden='true' />
            <div className='invisible pointer-events-none absolute left-0 top-12 z-20 w-[23rem] translate-y-1 rounded-lg border border-[#e0e5ed] bg-white p-2 opacity-0 shadow-[0_22px_70px_rgba(25,34,52,0.15)] transition group-hover:visible group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-[#273345] dark:bg-[#111927] dark:shadow-[0_22px_70px_rgba(0,0,0,0.42)]'>
                {items.map((item) => {
                    const Icon = item.icon
                    return (
                        <Link key={item.title} href={item.href} className='grid grid-cols-[2.5rem_1fr] gap-3 rounded-lg p-3 transition hover:bg-[#f6f8fb] dark:hover:bg-white/6'>
                            <span className='grid h-10 w-10 place-items-center rounded-lg border border-[#e1e7f0] bg-[#f8fafc] text-[#3056d3] dark:border-[#2b3a52] dark:bg-[#172234] dark:text-[#8fb2ff]'>
                                <Icon className='h-4.5 w-4.5' />
                            </span>
                            <span className='grid gap-0.5'>
                                <span className='text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{item.title}</span>
                                <span className='text-xs leading-5 text-[#667085] dark:text-[#a8b3c5]'>{item.detail}</span>
                            </span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

export default function Header({ token, path: serverPath }: { token: boolean, path: string }) {
    const baseStyles = 'group grid h-10 w-10 place-items-center rounded-lg border border-[#dfe5ee] text-[#4b5565] transition hover:bg-[#f6f8fb] hover:text-[#111827]'
    const pathname = usePathname() || serverPath
    const isStatus = pathname.includes('/status')
    const isShare = isSharePath(pathname)
    const isAI = pathname.endsWith('/ai') || pathname.includes('/ai/')
    const isDashboard = pathname.startsWith('/dashboard')
    const isProfile = pathname.startsWith('/profile')
    const isPublicProduct = isPublicProductPath(pathname)
    const isAppSurface = !isPublicProduct && (isShare || isAI || isDashboard || isProfile)

    if (!isAppSurface) {
        return (
            <header className='fixed left-0 top-0 z-1000 w-full border-b border-[#e1e5ec] bg-white px-3 sm:px-5 md:px-10 lg:px-16 dark:border-[#243044] dark:bg-[#0e1520]'>
                <div className='mx-auto flex h-18 w-full max-w-7xl items-center justify-between gap-5'>
                    <BrandLogo />

                    <nav className='hidden items-center gap-5 lg:flex'>
                        <PublicDropdown label='Product' items={productItems} />
                        <PublicDropdown label='Solutions' items={solutionItems} />
                        <Link href='/developers' className='inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[#3a404b] transition hover:bg-[#f1f4f8] hover:text-[#16181d] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white'>
                            Developers
                            <Code2 className='h-4 w-4 text-[#7a8493]' />
                        </Link>
                        <PublicDropdown label='Resources' items={resourceItems} />
                        <Link href='/pricing' className='inline-flex h-10 items-center rounded-lg px-2 text-sm font-semibold text-[#3a404b] transition hover:bg-[#f1f4f8] hover:text-[#16181d] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white'>Pricing</Link>
                    </nav>

                    <div className='flex items-center justify-end gap-2'>
                        <ThemeSwitch />
                        <Link href='/contact?intent=sales' className='hidden h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#2f3540] transition hover:bg-[#f1f4f8] md:inline-flex dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white'>Contact sales</Link>
                        <Link href={token ? '/dashboard/overview' : '/login'} className='inline-flex h-11 items-center gap-2 rounded-lg bg-[#22252d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#111318]'>
                            Go to Console
                        </Link>
                        <Link href='/ti' aria-label='Search intelligence' className='grid h-11 w-11 place-items-center rounded-lg border border-[#dfe5ee] text-[#3a404b] transition hover:bg-[#f6f8fb] lg:hidden'>
                            <Search className='h-5 w-5' />
                        </Link>
                    </div>
                </div>
            </header>
        )
    }

    return (
        <header className='fixed left-0 top-0 z-1000 w-full border-b border-[#e1e5ec] bg-white/95 px-3 shadow-[0_1px_0_rgba(17,24,39,0.03)] backdrop-blur sm:px-5 md:px-8 dark:border-[#243044] dark:bg-[#0e1520]/95'>
            <div className='mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4'>
                <div className='flex min-w-0 items-center gap-4'>
                    <BrandLogo />
                    {!isDashboard && !isProfile && (
                        <nav className='hidden items-center gap-1 lg:flex'>
                            {token ? (
                                <Link href='/dashboard' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#3a404b] transition hover:bg-[#f1f4f8] hover:text-[#16181d] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white'>Console</Link>
                            ) : null}
                            <Link href='/ti' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#3a404b] transition hover:bg-[#f1f4f8] hover:text-[#16181d] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white'>Threat search</Link>
                            <Link href='/solutions/dwm' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#3a404b] transition hover:bg-[#f1f4f8] hover:text-[#16181d] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white'>Dark web</Link>
                            <Link href='/developers' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#3a404b] transition hover:bg-[#f1f4f8] hover:text-[#16181d] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white'>API docs</Link>
                            <Link href='/pricing' className='inline-flex h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#3a404b] transition hover:bg-[#f1f4f8] hover:text-[#16181d] dark:text-[#d9e2f2] dark:hover:bg-white/8 dark:hover:text-white'>Pricing</Link>
                        </nav>
                    )}
                </div>
                <div className='flex items-center justify-end gap-2'>
                    {token && isDashboard && <ViewModeToggle />}
                    {isShare ? <ShareIcon baseStyles={baseStyles} isShare={isShare} href='/s' /> : null}
                    <Link href='/status' aria-label='Status' title='Status' className={`${baseStyles} hidden sm:grid`}>
                        <ActivityIcon className={`h-4.5 w-4.5 ${isStatus ? 'text-[#087b34]' : ''}`} />
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
