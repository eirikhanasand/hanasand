'use client'

import config from '@/config'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, ArrowUpRight, BellRing, BookOpen, Code2, FileText, Gauge, Globe, LockKeyhole, Network, Radar, ShieldCheck, Sparkles, Waypoints } from 'lucide-react'
import isSharePath from '@/utils/routes/isSharePath'
import BrandLogo from '@/components/brand/brandLogo'

const footerGroups = [
    {
        title: 'Product',
        links: [
            { label: 'Dark Web Monitoring', href: '/solutions/dwm', icon: BellRing },
            { label: 'Threat Intelligence', href: '/ti', icon: Radar },
            { label: 'Organizations', href: '/organizations', icon: ShieldCheck },
            { label: 'Actor Overview', href: '/ti', icon: Waypoints },
        ],
    },
    {
        title: 'Solutions',
        links: [
            { label: 'All Solutions', href: '/solutions', icon: ShieldCheck },
            { label: 'Browser Sandbox', href: '/solutions/browser', icon: Network },
            { label: 'API docs', href: '/developers', icon: Code2 },
            { label: 'Pricing', href: '/pricing', icon: Activity },
        ],
    },
    {
        title: 'Developers',
        links: [
            { label: 'Support', href: '/support', icon: ArrowUpRight },
            { label: 'Status', href: '/status', icon: Activity, status: true },
            { label: 'Service Checks', href: '/test', icon: Gauge },
            { label: 'Hash Exposure Lookup', href: '/pwned', icon: LockKeyhole },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About', href: '/about', icon: BookOpen },
            { label: 'Trust Center', href: '/trust', icon: FileText },
            { label: 'Eirik', href: '/eirik', icon: BookOpen },
            { label: 'Articles', href: '/articles', icon: BookOpen },
        ],
    },
    {
        title: 'Legal',
        links: [
            { label: 'Terms of use', href: '/terms', icon: BookOpen },
            { label: 'Privacy policy', href: '/privacy', icon: BookOpen },
            { label: 'Cookie policy', href: '/cookies', icon: BookOpen },
            { label: 'Cookie settings', href: '/cookie-settings', icon: BookOpen },
        ],
    },
]

export default function Footer() {
    const pathname = usePathname()
    const isShare = isSharePath(pathname)
    const year = new Date().getFullYear()

    return (
        <footer className={`${isShare ? 'hidden' : ''} w-full border-t border-ui-border bg-ui-canvas px-4 pb-8 pt-12 text-sm text-ui-muted md:px-8`}>
            <section className='mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.05fr_2fr]'>
                <div className='min-w-0'>
                    <BrandLogo />
                    <p className='mt-4 max-w-md text-sm leading-6 text-ui-muted'>
                        Company exposure monitoring, actor context, source-aware alerts, and developer-ready threat intelligence under one product shell.
                    </p>
                    <div className='mt-4 flex flex-wrap gap-2'>
                        <span className='inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 text-[11px] text-ui-text'>
                            <Sparkles className='h-3.5 w-3.5 text-ui-primary' />
                            monitoring API
                        </span>
                        <span className='inline-flex items-center gap-1.5 rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 text-[11px] text-ui-text'>
                            <Globe className='h-3.5 w-3.5 text-ui-success' />
                            customer alerts
                        </span>
                    </div>
                </div>

                <nav aria-label='Footer' className='grid gap-6 sm:grid-cols-2 lg:grid-cols-5'>
                    {footerGroups.map((group) => (
                        <div key={group.title}>
                            <h2 className='mb-3 text-sm font-semibold text-ui-text'>{group.title}</h2>
                            <div className='grid gap-1'>
                                {group.links.map((link) => {
                                    const Icon = link.icon
                                    return (
                                        <Link
                                            key={`${group.title}-${link.label}-${link.href}`}
                                            href={link.href}
                                            className='inline-flex w-fit items-center gap-1.5 py-1.5 text-sm font-medium text-ui-muted transition-colors hover:text-ui-text'
                                        >
                                            {Icon ? <Icon className={`h-3.5 w-3.5 ${link.status ? 'text-ui-success' : 'text-ui-muted'}`} /> : null}
                                            {link.label}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </section>

            <section className='mx-auto mt-10 flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-ui-border pt-6 text-sm text-ui-muted'>
                <Link href='/status' className='inline-flex min-h-9 items-center gap-2 font-semibold text-ui-text'>
                    <span className='h-2.5 w-2.5 rounded-full bg-ui-success shadow-sm' />
                    All systems operational
                </Link>
                <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
                    <Link href='/terms' className='inline-flex min-h-9 items-center hover:text-ui-text'>Terms of use</Link>
                    <Link href='/privacy' className='inline-flex min-h-9 items-center hover:text-ui-text'>Privacy policy</Link>
                    <Link href='/cookies' className='inline-flex min-h-9 items-center hover:text-ui-text'>Cookie policy</Link>
                    <Link href='/cookie-settings' className='inline-flex min-h-9 items-center hover:text-ui-text'>Cookie settings</Link>
                    <span>© {year} Hanasand</span>
                </div>
                <span>v{config.version}</span>
            </section>
        </footer>
    )
}
