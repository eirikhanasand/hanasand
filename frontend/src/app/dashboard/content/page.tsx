import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import fetchArticles from '@/utils/articles/fetchArticles'
import fetchThoughts from '@/utils/thoughts/fetchThoughts'
import { BookOpen, BrainCircuit, Clock3, Plus } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export default async function Page() {
    const [articles, thoughts] = await Promise.all([
        fetchArticles() as Promise<Article[]>,
        fetchThoughts(),
    ])
    const latestArticle = latestByDate(articles, item => item.modified || item.created)
    const latestThought = latestByDate(thoughts, item => item.updated_at || item.created_at)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Publishing'
                title='Content management'
                description='Articles and thoughts live here, separate from user access and roles.'
            />

            <section className='grid gap-3 md:grid-cols-2'>
                <ContentLane
                    icon={<BookOpen className='h-4 w-4' />}
                    title='Articles'
                    count={articles.length}
                    latest={latestArticle ? shortDate(latestArticle.modified || latestArticle.created) : 'Ready'}
                    detail={latestArticle?.title || 'Create the first article'}
                    href='/dashboard/articles'
                    createHref='/dashboard/articles/create'
                    createLabel='Create article'
                />
                <ContentLane
                    icon={<BrainCircuit className='h-4 w-4' />}
                    title='Thoughts'
                    count={thoughts.length}
                    latest={latestThought ? shortDate(latestThought.updated_at || latestThought.created_at) : 'Ready'}
                    detail={latestThought?.title || 'Create the first thought'}
                    href='/dashboard/thoughts'
                    createHref='/dashboard/thoughts/create'
                    createLabel='Create thought'
                />
            </section>
        </DashboardPage>
    )
}

function ContentLane({ icon, title, count, latest, detail, href, createHref, createLabel }: {
    icon: ReactNode
    title: string
    count: number
    latest: string
    detail: string
    href: string
    createHref: string
    createLabel: string
}) {
    return (
        <DashboardPanel className='grid gap-4 p-4'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-ui-muted'>
                        {icon}
                        <h2 className='text-base font-semibold text-ui-text'>{title}</h2>
                    </div>
                    <p className='mt-2 text-sm text-ui-muted'>{count} rows</p>
                </div>
                <Link href={createHref} className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-text transition hover:opacity-90'>
                    <Plus className='h-4 w-4' />
                    {createLabel}
                </Link>
            </div>
            <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-canvas p-3'>
                <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                    <Clock3 className='h-4 w-4 text-ui-primary' />
                    Latest movement: {latest}
                </div>
                <p className='line-clamp-2 text-sm text-ui-muted'>{detail}</p>
            </div>
            <Link href={href} className='inline-flex h-10 items-center justify-center rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:text-ui-primary'>
                Open {title.toLowerCase()}
            </Link>
        </DashboardPanel>
    )
}

function latestByDate<T>(items: T[], getDate: (item: T) => string) {
    return [...items].sort((a, b) => dateMs(getDate(b)) - dateMs(getDate(a)))[0]
}

function dateMs(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function shortDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Synced'
    return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
