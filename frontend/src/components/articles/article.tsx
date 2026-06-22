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
        <article className='mx-auto grid min-h-[calc(100vh-4.5rem)] w-full max-w-4xl gap-6 bg-[#f7f8fb] px-4 py-12 text-[#171a21] md:px-10 md:py-16 lg:px-0'>
            <div className='grid gap-5 rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm md:p-7'>
                <Link
                    href='/articles'
                    className='inline-flex w-fit items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5]'
                >
                    <ArrowLeft className='h-4 w-4' />
                    Articles
                </Link>
                <div className='grid gap-3'>
                    <h1 className='text-3xl font-semibold leading-tight tracking-normal text-[#171a21] md:text-5xl'>{article.title}</h1>
                    {article.metadata.description ? (
                        <p className='max-w-2xl text-base leading-7 text-[#596170]'>
                            {article.metadata.description}
                        </p>
                    ) : null}
                </div>
                <div className='flex flex-wrap gap-2 text-xs font-medium text-[#667085]'>
                    <span className='inline-flex items-center gap-2 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-3 py-2'>
                        <CalendarDays className='h-3.5 w-3.5 text-[#3056d3]' />
                        Published {published}
                    </span>
                    <span className='inline-flex items-center gap-2 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-3 py-2'>
                        <Clock3 className='h-3.5 w-3.5 text-[#3056d3]' />
                        Updated {edited}
                    </span>
                    {article.metadata.estimatedMinutes ? (
                        <span className='inline-flex items-center gap-2 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] px-3 py-2'>
                            {article.metadata.estimatedMinutes} min read
                        </span>
                    ) : null}
                </div>
            </div>

            <div className='rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm md:p-8'>
                <MarkdownRender MDstr={body} />
            </div>

            <Link
                href='/articles'
                className='inline-flex w-fit items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5]'
            >
                <ArrowLeft className='h-4 w-4' />
                Browse other articles
            </Link>
        </article>
    )
}
