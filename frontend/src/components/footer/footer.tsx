'use client'

import config from '@/config'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity, ArrowUpRight, BookOpen, FolderArchive, Sparkles } from 'lucide-react'
import isSharePath from '@/utils/routes/isSharePath'

const footerGroups = [
    {
        title: 'Product',
        links: [
            { label: 'Workspace', href: '/s' },
            { label: 'AI assistant', href: '/ai' },
            { label: 'Status', href: '/status', status: true },
            { label: 'Dashboard', href: '/dashboard/overview' },
        ],
    },
    {
        title: 'Eirik',
        links: [
            { label: 'Personal archive', href: '/eirik' },
            { label: 'Motivation wall', href: '/eirik/motivation' },
            { label: 'Articles', href: '/articles' },
            { label: 'Contact', href: '/contact' },
        ],
    },
    {
        title: 'Older tools',
        links: [
            { label: 'Password check', href: '/pwned' },
            { label: 'Upload media', href: '/upload' },
            { label: 'Short links', href: '/g' },
            { label: 'Load tests', href: '/test' },
        ],
    },
]

export default function Footer() {
    const pathname = usePathname()
    const isShare = isSharePath(pathname)
    const year = new Date().getFullYear()

    return (
        <footer className={`${isShare ? 'hidden' : ''} w-full px-4 pb-8 pt-10 text-sm text-bright/42 md:px-8`}>
            <section className='mx-auto grid w-full max-w-6xl gap-8 border-t border-bright/8 pt-7 lg:grid-cols-[1.1fr_1.9fr]'>
                <div className='min-w-0'>
                    <Link href='/' className='inline-flex items-center gap-3 text-[13px] font-medium text-bright/76 transition-colors hover:text-bright'>
                        <span className='grid h-8 w-8 place-items-center rounded-lg border border-bright/10 bg-bright/8 font-serif text-base text-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'>H</span>
                        <span className='grid gap-0.5'>
                            <span>hanasand</span>
                            <span className='text-[11px] font-normal text-bright/34'>operations workspace</span>
                        </span>
                    </Link>
                    <p className='mt-4 max-w-md text-sm leading-6 text-bright/42'>
                        A focused surface for projects, service status, uploads, short links, and account access.
                    </p>
                    <div className='mt-4 flex flex-wrap gap-2'>
                        <span className='inline-flex items-center gap-1.5 rounded-full border border-bright/8 px-2.5 py-1 text-[11px] text-bright/44'>
                            <Sparkles className='h-3.5 w-3.5 text-orange-200/60' />
                            product workspace
                        </span>
                        <span className='inline-flex items-center gap-1.5 rounded-full border border-bright/8 px-2.5 py-1 text-[11px] text-bright/44'>
                            <FolderArchive className='h-3.5 w-3.5 text-bright/42' />
                            personal archive
                        </span>
                    </div>
                </div>

                <nav aria-label='Footer' className='grid gap-5 sm:grid-cols-3'>
                    {footerGroups.map((group) => (
                        <div key={group.title}>
                            <h2 className='mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-bright/32'>
                                {group.title === 'Eirik' ? <BookOpen className='h-3.5 w-3.5' /> : null}
                                {group.title}
                            </h2>
                            <div className='grid gap-1'>
                                {group.links.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className='inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-bright/48 transition-colors hover:bg-bright/7 hover:text-bright/78'
                                    >
                                        {link.label}
                                        {link.status ? <Activity className='h-3 w-3 text-[#9de18f]/70' /> : <ArrowUpRight className='h-3 w-3 text-bright/24' />}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </section>

            <section className='mx-auto mt-4 flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 text-[11px] text-bright/28'>
                <span>© {year} Hanasand</span>
                <span>v{config.version}</span>
            </section>
        </footer>
    )
}
