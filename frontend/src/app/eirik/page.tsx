import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
    ArrowUpRight,
    BookOpen,
    Code2,
    FileText,
    GalleryHorizontal,
    Link2,
    MonitorSmartphone,
    ShieldCheck,
    Sparkles,
    UploadCloud,
} from 'lucide-react'
import fetchArticles from '@/utils/articles/fetchArticles'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Eirik Hanasand',
    description: 'Personal archive, articles, apps, experiments, and older Hanasand projects by Eirik Hanasand.',
    path: '/eirik',
    keywords: ['eirik hanasand', 'personal archive', 'articles', 'event app', 'password check', 'upload media'],
})

const personalProjects = [
    {
        title: 'Password exposure check',
        description: 'Exact-match password exposure checks from the original personal-tool era of Hanasand.',
        href: '/pwned',
        icon: ShieldCheck,
        tag: 'security',
    },
    {
        title: 'Upload media',
        description: 'A media upload and preview workflow for quick files, images, and CDN experiments.',
        href: '/upload',
        icon: UploadCloud,
        tag: 'media',
    },
    {
        title: 'Short links',
        description: 'Small link utility for creating compact routes and sharing one-off references.',
        href: '/g',
        icon: Link2,
        tag: 'utility',
    },
    {
        title: 'Load and route tests',
        description: 'Public test surfaces used while hardening uptime, routing, and service checks.',
        href: '/test',
        icon: Sparkles,
        tag: 'operations',
    },
    {
        title: 'Motivation wall',
        description: 'The restored old quote wall: a slow, black-background stream of motivational quotes.',
        href: '/eirik/motivation',
        icon: BookOpen,
        tag: 'archive',
    },
    {
        title: 'Articles',
        description: 'Longer writeups and project notes that explain the experiments in context.',
        href: '/articles',
        icon: FileText,
        tag: 'writing',
    },
]

const archiveProjects = [
    {
        title: 'React Native event management application',
        description: 'Phones, event schedules, and mobile flows from the app work that used to sit directly on the personal homepage.',
        image: '/images/assets/iphone-events.png',
        href: '/articles',
        label: 'mobile app',
    },
    {
        title: 'Pecubit and app design experiments',
        description: 'Visual product experiments, phone mockups, and earlier app interface work kept as part of the personal archive.',
        image: '/images/assets/pecubit.png',
        href: '/articles',
        label: 'interface design',
    },
]

const olderWork = [
    'Library safety manager and small operational dashboards.',
    'Discord bot work for organization, infrastructure, and community automation.',
    'Markdown, editor, upload, CDN, and short-link experiments.',
    'Service status, monitoring, and route-hardening tools that later fed the product workspace.',
    'Private notes are now a separate authenticated workspace feature, not part of the public quote wall.',
]

export default async function EirikPage() {
    const articles = await fetchArticles(false, false)

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] text-[#171a21]'>
            <div className='mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-12 md:px-8 md:py-16'>
                <section className='grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-[#3056d3]'>Personal archive</p>
                        <h1 className='mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-[#171a21] md:text-6xl'>Eirik Hanasand</h1>
                        <p className='mt-5 max-w-2xl text-base leading-7 text-[#596170] md:text-lg md:leading-8'>
                            This is the preserved personal side of Hanasand: older tools, article projects, app experiments,
                            and the little practical utilities that existed before the site became a product workspace.
                        </p>
                        <div className='mt-7 flex flex-wrap gap-3'>
                            <Link href='/articles' className='inline-flex items-center gap-2 rounded-lg bg-[#171a21] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'>
                                <BookOpen className='h-4 w-4' />
                                Read articles
                            </Link>
                            <Link href='/eirik/motivation' className='inline-flex items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 py-2.5 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5]'>
                                Motivation wall
                                <ArrowUpRight className='h-4 w-4' />
                            </Link>
                        </div>
                    </div>

                    <div className='grid gap-4 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-[0_20px_70px_rgba(26,35,55,0.10)]'>
                        <div className='overflow-hidden rounded-lg border border-[#e0e5ed] bg-[#eef1f5]'>
                            <Image
                                src='/images/assets/selfie.jpeg'
                                alt='Eirik Hanasand'
                                width={900}
                                height={760}
                                priority
                                className='aspect-[4/3] w-full object-cover'
                            />
                        </div>
                        <div className='grid gap-2 text-sm leading-6 text-[#596170]'>
                            <p className='font-semibold text-[#171a21]'>README</p>
                            <p>
                                Product Hanasand can move forward without erasing the earlier personal work. This route keeps
                                the old project context visible without turning the main homepage back into a portfolio.
                            </p>
                        </div>
                    </div>
                </section>

                <section className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
                    {personalProjects.map((project) => {
                        const Icon = project.icon
                        return (
                            <Link key={project.href} href={project.href} className='group rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm transition hover:border-[#bdc7d5]'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div className='grid h-10 w-10 place-items-center rounded-lg border border-[#dfe5ee] bg-[#f8fafc] text-[#3056d3]'>
                                        <Icon className='h-4.5 w-4.5' />
                                    </div>
                                    <span className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold uppercase text-[#667085]'>
                                        {project.tag}
                                    </span>
                                </div>
                                <h2 className='mt-5 text-lg font-semibold text-[#171a21]'>{project.title}</h2>
                                <p className='mt-2 text-sm leading-6 text-[#596170]'>{project.description}</p>
                            </Link>
                        )
                    })}
                </section>

                <section className='grid gap-6 lg:grid-cols-[0.9fr_1.1fr]'>
                    <div className='rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm'>
                        <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                            <Code2 className='h-4 w-4 text-[#3056d3]' />
                            Older project notes
                        </div>
                        <ul className='mt-5 grid gap-3 text-sm leading-6 text-[#596170]'>
                            {olderWork.map((item) => (
                                <li key={item} className='flex gap-3'>
                                    <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3056d3]' />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2'>
                        {archiveProjects.map((project) => (
                            <Link key={project.title} href={project.href} className='group overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm transition hover:border-[#bdc7d5]'>
                                <Image src={project.image} alt={project.title} width={720} height={520} className='aspect-[4/3] w-full object-cover' />
                                <div className='p-5'>
                                    <div className='flex items-center gap-2 text-[11px] font-semibold uppercase text-[#667085]'>
                                        <MonitorSmartphone className='h-3.5 w-3.5' />
                                        {project.label}
                                    </div>
                                    <h2 className='mt-3 text-lg font-semibold text-[#171a21]'>{project.title}</h2>
                                    <p className='mt-2 text-sm leading-6 text-[#596170]'>{project.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className='rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-[#667085]'>Article projects</p>
                            <h2 className='mt-2 text-2xl font-semibold text-[#171a21]'>Writing and build notes</h2>
                        </div>
                        <Link href='/articles' className='inline-flex w-fit items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5]'>
                            All articles
                            <ArrowUpRight className='h-4 w-4' />
                        </Link>
                    </div>

                    <div className='mt-6 grid gap-3 md:grid-cols-2'>
                        {articles.length ? articles.map((article) => (
                            <Link key={article.id} href={`/articles/${article.id}`} className='rounded-lg border border-[#e0e5ed] bg-[#f8fafc] p-4 transition hover:border-[#bdc7d5]'>
                                <div className='flex items-start justify-between gap-4'>
                                    <h3 className='text-base font-semibold text-[#171a21]'>{article.title}</h3>
                                    <GalleryHorizontal className='mt-0.5 h-4 w-4 shrink-0 text-[#667085]' />
                                </div>
                                <p className='mt-2 line-clamp-3 text-sm leading-6 text-[#596170]'>
                                    {article.metadata.description || 'Project note from the personal Hanasand archive.'}
                                </p>
                                <p className='mt-4 text-xs text-[#667085]'>{article.metadata.estimatedMinutes || 1} min read</p>
                            </Link>
                        )) : (
                            <div className='rounded-lg border border-[#e0e5ed] bg-[#f8fafc] p-4 text-sm leading-6 text-[#596170] md:col-span-2'>
                                Articles are unavailable right now, but this archive keeps the article project surface ready for production.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    )
}
