import fetchArticle from '@/utils/articles/fetchArticle'
import { redirect } from 'next/navigation'
import MarkdownRender from '../markdown/markdown'
import Link from 'next/link'
import prettyDate from '@/utils/date/prettyDate'
import { ArrowLeft, CalendarDays, Clock3 } from 'lucide-react'

export default async function Article({ id }: { id: string }) {
    const article = await fetchArticle(id.endsWith('.md') ? id : `${id}.md`)
    if (id === 'featured' || id === 'main') {
        redirect('/articles')
    }

    if (!article) {
        redirect(`/articles?error=404&path=${id}`)
    }

    const published = prettyDate(article.created)
    const edited = prettyDate(article.modified)
    const body = article.content.replace(/^\s*# .*(\r?\n)+/, '')

    return (
        <article className='mx-auto grid min-h-[calc(100vh-4.5rem)] w-full max-w-4xl gap-6 bg-ui-canvas px-4 py-12 text-ui-text md:px-10 md:py-16 lg:px-0'>
            <div className='grid gap-5 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm shadow-ui-canvas/20 md:p-7'>
                <Link
                    href='/articles'
                    className='inline-flex w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-raised'
                >
                    <ArrowLeft className='h-4 w-4' />
                    Articles
                </Link>
                <div className='grid gap-3'>
                    <h1 className='text-3xl font-semibold leading-tight tracking-normal text-ui-text md:text-5xl'>{article.title}</h1>
                    {article.metadata.description ? (
                        <p className='max-w-2xl text-base leading-7 text-ui-muted'>
                            {article.metadata.description}
                        </p>
                    ) : null}
                </div>
                <div className='flex flex-wrap gap-2 text-xs font-medium text-ui-muted'>
                    <span className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                        <CalendarDays className='h-3.5 w-3.5 text-ui-primary' />
                        Published {published}
                    </span>
                    <span className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                        <Clock3 className='h-3.5 w-3.5 text-ui-primary' />
                        Updated {edited}
                    </span>
                    {article.metadata.estimatedMinutes ? (
                        <span className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>
                            {article.metadata.estimatedMinutes} min read
                        </span>
                    ) : null}
                </div>
            </div>

            <div className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm shadow-ui-canvas/20 md:p-8'>
                <MarkdownRender MDstr={body} />
            </div>

            <Link
                href='/articles'
                className='inline-flex w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-raised'
            >
                <ArrowLeft className='h-4 w-4' />
                Browse other articles
            </Link>
        </article>
    )
}
