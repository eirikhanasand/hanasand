'use client'

import config from '@/config'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, ArrowUpRight, BellRing, BookOpen, Code2, Globe, LockKeyhole, Radar, ShieldCheck, Sparkles, Waypoints } from 'lucide-react'
import isSharePath from '@/utils/routes/isSharePath'
import BrandLogo from '@/components/brand/brandLogo'

const footerGroups = [
    {
        title: 'Product',
        links: [
            { label: 'Threat Intelligence', href: '/ti', icon: Radar },
            { label: 'Dark Web Monitoring', href: '/solutions/dwm', icon: BellRing },
            { label: 'Actor Overview', href: '/ti', icon: Waypoints },
        ],
    },
    {
        title: 'Solutions',
        links: [
            { label: 'All Solutions', href: '/solutions', icon: ShieldCheck },
            { label: 'Bloom Filter', href: '/pwned', icon: LockKeyhole },
            { label: 'Pricing', href: '/pricing', icon: Activity },
        ],
    },
    {
        title: 'Developers',
        links: [
            { label: 'API docs', href: '/developers', icon: Code2 },
            { label: 'Contact sales', href: '/contact', icon: ArrowUpRight },
            { label: 'Status', href: '/status', icon: Activity, status: true },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About', href: '/about', icon: BookOpen },
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
        <footer className={`${isShare ? 'hidden' : ''} w-full border-t border-[#e1e5ec] bg-[#f7f8fb] px-4 pb-8 pt-12 text-sm text-[#596170] md:px-8 dark:border-[#243044] dark:bg-[#0b111a] dark:text-[#a8b3c5]`}>
            <section className='mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.05fr_2fr]'>
                <div className='min-w-0'>
                    <BrandLogo />
                    <p className='mt-4 max-w-md text-sm leading-6 text-[#596170] dark:text-[#a8b3c5]'>
                        Company exposure monitoring, actor context, webhooks, and private utility surfaces under one product shell.
                    </p>
                    <div className='mt-4 flex flex-wrap gap-2'>
                        <span className='inline-flex items-center gap-1.5 rounded-full border border-[#dfe5ee] bg-white px-2.5 py-1 text-[11px] text-[#3d4656] dark:border-[#26344a] dark:bg-[#111927] dark:text-[#d9e2f2]'>
                            <Sparkles className='h-3.5 w-3.5 text-[#3056d3]' />
                            monitoring API
                        </span>
                        <span className='inline-flex items-center gap-1.5 rounded-full border border-[#dfe5ee] bg-white px-2.5 py-1 text-[11px] text-[#3d4656] dark:border-[#26344a] dark:bg-[#111927] dark:text-[#d9e2f2]'>
                            <Globe className='h-3.5 w-3.5 text-[#147a3b]' />
                            customer alerts
                        </span>
                    </div>
                </div>

                <nav aria-label='Footer' className='grid gap-6 sm:grid-cols-2 lg:grid-cols-5'>
                    {footerGroups.map((group) => (
                        <div key={group.title}>
                            <h2 className='mb-3 text-sm font-semibold text-[#171a21] dark:text-[#f5f7fb]'>{group.title}</h2>
                            <div className='grid gap-1'>
                                {group.links.map((link) => {
                                    const Icon = link.icon
                                    return (
                                        <Link
                                            key={`${group.title}-${link.label}-${link.href}`}
                                            href={link.href}
                                            className='inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[#596170] transition-colors hover:bg-white hover:text-[#171a21] dark:text-[#a8b3c5] dark:hover:bg-white/7 dark:hover:text-white'
                                        >
                                            {Icon ? <Icon className={`h-3.5 w-3.5 ${link.status ? 'text-[#10b35a]' : 'text-[#8c95a5]'}`} /> : null}
                                            {link.label}
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </section>

            <section className='mx-auto mt-10 flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-[#e1e5ec] pt-6 text-sm text-[#596170] dark:border-[#243044] dark:text-[#a8b3c5]'>
                <Link href='/status' className='inline-flex items-center gap-2 font-semibold text-[#3d4656] dark:text-[#d9e2f2]'>
                    <span className='h-2.5 w-2.5 rounded-full bg-[#19c463] shadow-[0_0_0_6px_rgba(25,196,99,0.10)]' />
                    All systems operational
                </Link>
                <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
                    <Link href='/terms' className='hover:text-[#171a21] dark:hover:text-white'>Terms of use</Link>
                    <Link href='/privacy' className='hover:text-[#171a21] dark:hover:text-white'>Privacy policy</Link>
                    <Link href='/cookies' className='hover:text-[#171a21] dark:hover:text-white'>Cookie policy</Link>
                    <Link href='/cookie-settings' className='hover:text-[#171a21] dark:hover:text-white'>Cookie settings</Link>
                    <span>© {year} Hanasand</span>
                </div>
                <span>v{config.version}</span>
            </section>
        </footer>
    )
}
