import Image from 'next/image'
import Link from 'next/link'
import './animate.css'
import fetchArticles from '@/utils/articles/fetchArticles'
import prettyDate from '@/utils/date/prettyDate'
import ArticleNotification from './articleNotification'
import { BookOpen, FileText } from 'lucide-react'

type ArticleProps = {
    article: Article
}

type ArticlesProps = {
    recent?: boolean
    max?: number
    includeRecentTitle?: boolean
    backfill?: boolean
    error?: string
    errorPath?: string
}

type RecentProps = {
    recent: Article[]
    max?: number
    includeTitle?: boolean
    emptyMessage?: string
}

export default async function Articles({
    recent = false,
    max,
    includeRecentTitle = true,
    backfill = true,
    error,
    errorPath
}: ArticlesProps) {
    const response = await fetchArticles<typeof recent>(recent, backfill)
    const articles = normalizeArticles(Array.isArray(response) ? response : recent ? response.recent : response.articles)
    const allArticles = normalizeArticles(Array.isArray(response) ? articles : response.articles)
    const displayed = max ? allArticles.slice(max) : allArticles
    const message = error && error === '404' ? `The article '${errorPath}' does not exist.` : error
    const hasAnyArticles = articles.length > 0 || displayed.length > 0

    return (
        <section className='mx-auto grid w-full max-w-7xl gap-8 bg-ui-canvas px-4 py-12 text-ui-text md:px-8 md:py-16'>
            {message && <ArticleNotification message={message} />}
            <div className='grid gap-3'>
                <div className='flex items-center gap-3'>
                    <span className='grid h-10 w-10 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-primary shadow-sm shadow-ui-canvas/20'>
                        <BookOpen className='h-5 w-5' />
                    </span>
                    <h1 className='text-3xl font-semibold tracking-normal text-ui-text md:text-4xl'>Articles</h1>
                </div>
                <p className='max-w-2xl text-base leading-7 text-ui-muted'>
                    Project notes, product context, and preserved writing from the personal Hanasand notebook.
                </p>
            </div>
            <Recent recent={articles} max={max} includeTitle={includeRecentTitle} emptyMessage={hasAnyArticles ? 'No recent articles right now.' : 'No articles published.'} />
            {recent && displayed.length > 0 && <All recent={displayed} max={max} includeTitle={includeRecentTitle} />}
        </section>
    )
}

function Recent({ recent, max, includeTitle = true, emptyMessage = 'No articles published.' }: RecentProps) {
    const displayed = max ? recent.slice(0, max) : recent

    return (
        <div className='grid gap-3'>
            {includeTitle && <h2 className='text-xs font-semibold uppercase text-ui-primary'>Recently published</h2>}
            {displayed.length === 0 ? <EmptyArticles message={emptyMessage} /> : null}
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                {displayed.map((article) => <Article
                    key={article.title}
                    article={article}
                />)}
            </div>
        </div>
    )
}

function All({ recent, max, includeTitle = true }: RecentProps) {
    const displayed = max ? recent.slice(0, max) : recent

    return (
        <div className='grid gap-3'>
            {includeTitle && <h2 className='text-xs font-semibold uppercase text-ui-primary'>All articles</h2>}
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                {displayed.map((article) => <Article
                    key={article.title}
                    article={article}
                />)}
            </div>
        </div>
    )
}

function Article({ article }: ArticleProps) {
    const { id, title, created, metadata } = article

    return (
        <Link
            className='group h-full rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-ui-primary/35'
            href={`/articles/${id}`}
        >
            <article className='grid h-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm shadow-ui-canvas/20 transition hover:border-ui-border'>
                {metadata.image ? (
                    <div className='aspect-[16/9] overflow-hidden bg-ui-raised'>
                        <Image className='h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]' src={metadata.image} alt={title} width={800} height={450} />
                    </div>
                ) : null}
                <div className='grid content-start gap-3 p-5'>
                    <div className='grid gap-2'>
                        <p className='text-xs font-medium text-ui-muted'>Published {prettyDate(new Date(created).toISOString())}</p>
                        <h3 className='text-base font-semibold leading-6 text-ui-text'>{title}</h3>
                    </div>
                    <p className='line-clamp-3 text-sm leading-6 text-ui-muted'>{metadata.description}</p>
                    <p className='mt-auto text-sm font-semibold text-ui-primary'>
                        {metadata.wordCount > 100 ? 'Read article' : 'Brief note'}
                    </p>
                </div>
            </article>
        </Link>
    )
}

function normalizeArticles(value: unknown): Article[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value.flatMap((article) => {
        if (!article || typeof article !== 'object') {
            return []
        }

        const item = article as Partial<Article> & { created_at?: string }
        const title = item.title || item.id || 'Untitled article'
        return [{
            ...item,
            id: item.id || title,
            size: Number(item.size) || 0,
            title,
            created: item.created || item.created_at || new Date(0).toISOString(),
            modified: item.modified || item.created || item.created_at || new Date(0).toISOString(),
            content: item.content || '',
            metadata: {
                description: item.metadata?.description || '',
                image: item.metadata?.image || '',
                wordCount: Number(item.metadata?.wordCount) || 0,
                estimatedMinutes: Number(item.metadata?.estimatedMinutes) || 0,
                ...(item.metadata || {}),
            },
        } as Article]
    })
}

function EmptyArticles({ message }: { message: string }) {
    return (
        <div className='grid min-h-48 place-items-center rounded-lg border border-dashed border-ui-border bg-ui-panel p-6 text-center'>
            <div className='grid gap-3'>
                <div className='mx-auto grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised'>
                    <FileText className='h-5 w-5 text-ui-primary' />
                </div>
                <p className='text-sm text-ui-muted'>{message}</p>
            </div>
        </div>
    )
}
