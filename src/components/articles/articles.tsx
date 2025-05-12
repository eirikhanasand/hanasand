import Image from 'next/image'
import Link from "next/link"
import './animate.css'
import fetchArticles from "@/utils/articles/fetchArticles"

type ArticleProps = {
    article: Article
}

type ArticlesProps = {
    includeAll?: boolean
    max?: number
    includeRecentTitle?: boolean
}

type RecentProps = {
    recent: Article[]
    max?: number
    includeTitle?: boolean
}

export default async function Articles({ includeAll = true, max, includeRecentTitle = true }: ArticlesProps) {
    const { recent, articles } = await fetchArticles()
    const displayed = max ? articles.slice(max) : articles
    const oldArticles = displayed.length - recent.length

    return (
        <div className="p-16">
            <h1 className="text-foreground text-2xl font-semibold">Articles</h1>
            {!recent.length && !articles.length && <h1 className='bg-red-500/50 p-2 px-3 rounded-xl w-fit mt-2'>
                Oh! API limit reached. This is’nt supposed to happen. Let me know if you see this, and I’ll add caching.
            </h1>}
            <Recent recent={recent} max={max} includeTitle={includeRecentTitle} />
            {includeAll && recent.length > 0 && oldArticles > 0 &&
                <h1 className="text-foreground font-semibold mt-4 text-xl">All articles</h1>}
            {includeAll || !recent.length && <>
                <div className="grid grid-rows-2 grid-cols-2 gap-8 place-items-center mt-4">
                    {displayed.map((article) => <Article
                        key={article.title}
                        article={article}
                    />)}
                </div>
            </>}
        </div>
    )
}

function Recent({ recent, max, includeTitle = true }: RecentProps) {
    const displayed = max ? recent.slice(0, max) : recent

    return (
        <div className='grid gap-4 my-4'>
            {includeTitle && <h1 className='font-semibold text-xl'>Recently published</h1>}
            <div className='grid grid-cols-2 gap-8'>
                {displayed.map((article) => <Article
                    key={article.title}
                    article={article}
                />)}
            </div>
        </div>
    )
}

function Article({ article }: ArticleProps) {
    const { title, description, href, image, created, length } = article
    return (
        <Link
            className="hover:scale-[1.03] animate transition-1000 rounded-3xl"
            href={`/articles/${href}`}
        >
            <article className='bg-dark w-full h-[58vh] overflow-hidden rounded-2xl'>
                <Image className="w-full h-[55%] object-cover" src={image} alt={title} width={800} height={450} />
                <div className='mx-5 mt-5 text-foreground grid gap-2'>
                    <div className='flex justify-between w-full'>
                        <h1 className='text-lg font-semibold'>{title}</h1>
                        <h1 className='text-gray-500/70 min-w-fit text-xs mt-1'>Published {created}</h1>
                    </div>
                    <p className='text-gray-500'>{description}</p>
                    {length.wordCount > 100
                        ? <h1 className="text-foreground text-lg">See more →</h1>
                        : <h1 className='text-red-400'>This article is coming soon! &lt;3
                        </h1>}
                </div>
            </article>
        </Link>
    )
}
