import fetchArticle from '@/utils/articles/fetchArticle'
import { prettyDate } from '@/utils/prettyDate'
import { redirect } from 'next/navigation'
import MarkdownRender from '../markdown/markdown'
import Link from 'next/link'

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

    return (
        <div className='px-[20vw] max-h-full pb-10'>
            <div className='float-right text-superlight text-right w-fit'>
                <h1>Last edited {edited}</h1>
                <h1>Published {published}</h1>
            </div>
            <div>
                <MarkdownRender MDstr={article.content} />
                <div className='hover:scale-[1.03] bg-dark rounded-lg p-[0.5vh] px-4 w-fit cursor-pointer'>
                    <Link
                        href='/articles'
                        className='text-gray-500'
                    >
                        ← Browse other articles
                    </Link>
                </div>
            </div>
        </div>
    )
}
