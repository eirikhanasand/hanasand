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

    return (
        <section className='grid gap-6 px-4 py-8 md:px-12 lg:px-16'>
            {message && <ArticleNotification message={message} />}
            <div className='grid gap-2'>
                <div className='flex items-center gap-3 text-bright'>
                    <BookOpen className='h-5 w-5 text-[#f0a17a]' />
                    <h1 className='text-2xl font-semibold tracking-[-0.02em] text-bright'>Articles</h1>
                </div>
                <p className='max-w-2xl text-sm leading-6 text-bright/50'>
                    Notes, project writeups, and longer-form context from Hanasand.
                </p>
            </div>
            <Recent recent={articles} max={max} includeTitle={includeRecentTitle} />
            {recent && articles.length > 0 && <All recent={displayed} max={max} includeTitle={includeRecentTitle} />}
        </section>
    )
}

function Recent({ recent, max, includeTitle = true }: RecentProps) {
    const displayed = max ? recent.slice(0, max) : recent

    return (
        <div className='grid gap-3'>
            {includeTitle && <h2 className='text-sm font-semibold uppercase tracking-[0.16em] text-bright/38'>Recently published</h2>}
            {displayed.length === 0 ? <EmptyArticles /> : null}
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
            {includeTitle && <h2 className='text-sm font-semibold uppercase tracking-[0.16em] text-bright/38'>All articles</h2>}
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
            className='group h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#f0a17a]/55'
            href={`/articles/${id}`}
        >
            <article className='grid h-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.035] transition hover:border-white/16 hover:bg-white/[0.055]'>
                {metadata.image ? (
                    <div className='aspect-[16/9] overflow-hidden bg-black/20'>
                        <Image className='h-full w-full object-cover opacity-88 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100' src={metadata.image} alt={title} width={800} height={450} />
                    </div>
                ) : null}
                <div className='grid content-start gap-3 p-4 text-foreground'>
                    <div className='grid gap-2'>
                        <p className='text-xs text-bright/36'>Published {prettyDate(new Date(created).toISOString())}</p>
                        <h3 className='text-base font-semibold leading-6 text-bright/88'>{title}</h3>
                    </div>
                    <p className='line-clamp-3 text-sm leading-6 text-bright/50'>{metadata.description}</p>
                    <p className='mt-auto text-sm font-medium text-bright/72'>
                        {metadata.wordCount > 100 ? 'Read article →' : 'Brief note'}
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

function EmptyArticles() {
    return (
        <div className='grid min-h-48 place-items-center rounded-xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center'>
            <div className='grid gap-3'>
                <div className='mx-auto grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/4'>
                    <FileText className='h-5 w-5 text-[#f0a17a]' />
                </div>
                <p className='text-sm text-bright/50'>No articles are published here yet.</p>
            </div>
        </div>
    )
}
