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
    description: 'Personal notebook, articles, apps, experiments, and Hanasand project notes by Eirik Hanasand.',
    path: '/eirik',
    keywords: ['eirik hanasand', 'personal notebook', 'articles', 'event app', 'password check', 'upload media'],
})

const personalProjects = [
    {
        title: 'Password exposure check',
        description: 'Exact-match password exposure checks from the personal Hanasand utility set.',
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
        title: 'Service check',
        description: 'A small utility for checking availability, routing, and page response behavior.',
        href: '/test',
        icon: Sparkles,
        tag: 'operations',
    },
    {
        title: 'Motivation wall',
        description: 'A restored quote wall: a slow stream of motivational notes with its own mood.',
        href: '/eirik/motivation',
        icon: BookOpen,
        tag: 'notes',
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
        description: 'Visual product experiments, phone mockups, and app interface work from the design archive.',
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
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <div className='mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-12 md:px-8 md:py-16'>
                <section className='grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Personal notebook</p>
                        <h1 className='mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-ui-text md:text-6xl'>Eirik Hanasand</h1>
                        <p className='mt-5 max-w-2xl text-base leading-7 text-ui-muted md:text-lg md:leading-8'>
                            This is the personal side of Hanasand: article projects, app experiments,
                            and practical utilities that sit beside the product work.
                        </p>
                        <div className='mt-7 flex flex-wrap gap-3'>
                            <Link href='/articles' className='inline-flex items-center gap-2 rounded-lg bg-ui-text px-4 py-2.5 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                <BookOpen className='h-4 w-4' />
                                Read articles
                            </Link>
                            <Link href='/eirik/motivation' className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 py-2.5 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised'>
                                Motivation wall
                                <ArrowUpRight className='h-4 w-4' />
                            </Link>
                        </div>
                    </div>

                    <div className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                        <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-raised'>
                            <Image
                                src='/images/assets/selfie.jpeg'
                                alt='Eirik Hanasand'
                                width={900}
                                height={760}
                                priority
                                className='aspect-[4/3] w-full object-cover'
                            />
                        </div>
                        <div className='grid gap-2 text-sm leading-6 text-ui-muted'>
                            <p className='font-semibold text-ui-text'>README</p>
                            <p>
                                Product Hanasand can move forward without erasing the personal work. This route keeps
                                the project context visible without turning the main homepage back into a portfolio.
                            </p>
                        </div>
                    </div>
                </section>

                <section className='grid gap-3 md:grid-cols-2 lg:grid-cols-3'>
                    {personalProjects.map((project) => {
                        const Icon = project.icon
                        return (
                            <Link key={project.href} href={project.href} className='group rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm transition hover:border-ui-primary hover:bg-ui-raised'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                        <Icon className='h-4.5 w-4.5' />
                                    </div>
                                    <span className='rounded-lg border border-ui-border bg-ui-raised px-2.5 py-1 text-[11px] font-semibold uppercase text-ui-muted'>
                                        {project.tag}
                                    </span>
                                </div>
                                <h2 className='mt-5 text-lg font-semibold text-ui-text'>{project.title}</h2>
                                <p className='mt-2 text-sm leading-6 text-ui-muted'>{project.description}</p>
                            </Link>
                        )
                    })}
                </section>

                <section className='grid gap-6 lg:grid-cols-[0.9fr_1.1fr]'>
                    <div className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                        <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                            <Code2 className='h-4 w-4 text-ui-primary' />
                            Project notes
                        </div>
                        <ul className='mt-5 grid gap-3 text-sm leading-6 text-ui-muted'>
                            {olderWork.map((item) => (
                                <li key={item} className='flex gap-3'>
                                    <span className='mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ui-primary' />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className='grid gap-4 md:grid-cols-2'>
                        {archiveProjects.map((project) => (
                            <Link key={project.title} href={project.href} className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm transition hover:border-ui-primary hover:bg-ui-raised'>
                                <Image src={project.image} alt={project.title} width={720} height={520} className='aspect-[4/3] w-full object-cover' />
                                <div className='p-5'>
                                    <div className='flex items-center gap-2 text-[11px] font-semibold uppercase text-ui-muted'>
                                        <MonitorSmartphone className='h-3.5 w-3.5' />
                                        {project.label}
                                    </div>
                                    <h2 className='mt-3 text-lg font-semibold text-ui-text'>{project.title}</h2>
                                    <p className='mt-2 text-sm leading-6 text-ui-muted'>{project.description}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-ui-muted'>Article projects</p>
                            <h2 className='mt-2 text-2xl font-semibold text-ui-text'>Writing and build notes</h2>
                        </div>
                        <Link href='/articles' className='inline-flex w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised'>
                            All articles
                            <ArrowUpRight className='h-4 w-4' />
                        </Link>
                    </div>

                    <div className='mt-6 grid gap-3 md:grid-cols-2'>
                        {articles.length ? articles.map((article) => (
                            <Link key={article.id} href={`/articles/${article.id}`} className='rounded-lg border border-ui-border bg-ui-raised p-4 transition hover:border-ui-primary hover:bg-ui-panel'>
                                <div className='flex items-start justify-between gap-4'>
                                    <h3 className='text-base font-semibold text-ui-text'>{article.title}</h3>
                                    <GalleryHorizontal className='mt-0.5 h-4 w-4 shrink-0 text-ui-muted' />
                                </div>
                                <p className='mt-2 line-clamp-3 text-sm leading-6 text-ui-muted'>
                                    {article.metadata.description || 'Project note from the personal Hanasand notebook.'}
                                </p>
                                <p className='mt-4 text-xs text-ui-muted'>{article.metadata.estimatedMinutes || 1} min read</p>
                            </Link>
                        )) : (
                            <div className='rounded-lg border border-ui-border bg-ui-raised p-4 text-sm leading-6 text-ui-muted md:col-span-2'>
                                Articles are unavailable right now, but this notebook keeps the article project surface ready for production.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    )
}
