import Image from 'next/image'
import Link from 'next/link'
import './animate.css'
import fetchArticles from '@/utils/articles/fetchArticles'
import prettyDate from '@/utils/date/prettyDate'
import ArticleNotification from './articleNotification'

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
    const articles: Article[] = Array.isArray(response) ? response : recent ? response.recent : response.articles
    const allArticles: Article[] = Array.isArray(response) ? articles : response.articles
    const displayed = max ? allArticles.slice(max) : allArticles
    const message = error && error === '404' ? `The article '${errorPath}' does not exist.` : error

    return (
        <div className='p-4 md:p-16'>
            {message && <ArticleNotification message={message} />}
            <h1 className='text-foreground text-2xl font-semibold'>Articles</h1>
            <Recent recent={articles} max={max} includeTitle={includeRecentTitle} />
            {recent && articles.length > 0 && <All recent={displayed} max={max} includeTitle={includeRecentTitle} />}
        </div>
    )
}

function Recent({ recent, max, includeTitle = true }: RecentProps) {
    const displayed = max ? recent.slice(0, max) : recent

    return (
        <div className='grid gap-4 my-4'>
            {includeTitle && <h1 className='font-semibold text-xl'>Recently published</h1>}
            <div className='grid md:grid-cols-2 gap-8'>
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
        <div className='grid gap-4 my-4'>
            {includeTitle && <h1 className='font-semibold text-xl'>All articles</h1>}
            <div className='grid md:grid-cols-2 gap-8'>
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
            className='hover:scale-[1.03] transition-1000 rounded-3xl cursor-pointer h-fit md:h-full'
            href={`/articles/${id}`}
        >
            <article className='outline-1 outline-dark w-full h-full max-h-fit md:max-h-full lg:max-h-[58vh] overflow-hidden rounded-2xl'>
                {metadata.image && <Image className='w-full max-h-[15rem] md:h-[55%] object-cover' src={metadata.image} alt={title} width={800} height={450} />}
                <div className='p-5 text-foreground grid gap-2'>
                    <div className='w-full'>
                        <h1 className='text-gray-500/70 min-w-fit text-xs mt-1 float-right'>Published {prettyDate(new Date(created).toISOString())}</h1>
                        <h1 className='lg:text-lg font-semibold'>{title}</h1>
                    </div>
                    <p className='text-gray-500'>{metadata.description}</p>
                    {metadata.wordCount > 100
                        ? <h1 className='text-foreground text-lg'>See more →</h1>
                        : <h1 className='text-red-400'>This article is coming soon! &lt;3
                        </h1>}
                </div>
            </article>
        </Link>
    )
}
