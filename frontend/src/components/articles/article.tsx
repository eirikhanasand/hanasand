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
        <article className='mx-auto grid min-h-[90.5vh] w-full max-w-4xl gap-6 px-4 py-8 md:px-10 lg:px-0'>
            <div className='grid gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 md:p-6'>
                <Link
                    href='/articles'
                    className='inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-medium text-bright/60 transition hover:bg-white/7 hover:text-bright'
                >
                    <ArrowLeft className='h-4 w-4' />
                    Articles
                </Link>
                <div className='grid gap-3'>
                    <h1 className='text-3xl font-semibold leading-tight tracking-[-0.03em] text-bright md:text-4xl'>{article.title}</h1>
                    {article.metadata.description ? (
                        <p className='max-w-2xl text-sm leading-6 text-bright/52 md:text-base'>
                            {article.metadata.description}
                        </p>
                    ) : null}
                </div>
                <div className='flex flex-wrap gap-2 text-xs text-bright/45'>
                    <span className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/12 px-3 py-2'>
                        <CalendarDays className='h-3.5 w-3.5 text-[#f0a17a]' />
                        Published {published}
                    </span>
                    <span className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/12 px-3 py-2'>
                        <Clock3 className='h-3.5 w-3.5 text-[#f0a17a]' />
                        Updated {edited}
                    </span>
                    {article.metadata.estimatedMinutes ? (
                        <span className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/12 px-3 py-2'>
                            {article.metadata.estimatedMinutes} min read
                        </span>
                    ) : null}
                </div>
            </div>

            <div className='rounded-xl border border-white/10 bg-white/[0.025] p-4 md:p-7'>
                <MarkdownRender MDstr={body} />
            </div>

            <Link
                href='/articles'
                className='inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-medium text-bright/60 transition hover:bg-white/7 hover:text-bright'
            >
                <ArrowLeft className='h-4 w-4' />
                Browse other articles
            </Link>
        </article>
    )
}
