import fetchArticle from '@/utils/articles/fetchArticle'
import { prettyDate } from '@/utils/prettyDate'
import { redirect } from 'next/navigation'
import MarkdownRender from '../markdown/markdown'
import Link from 'next/link'

export default async function Article({ article }: { article: string }) {
    const data = await fetchArticle(article)
    if (article === 'featured' || article === 'main' || !data) {
        redirect('/articles')
    }

    const text = data.text
    const commits = data.commits
    const created = prettyDate(commits[commits.length - 1].commit.committer.date)
    const edited = prettyDate(commits[0].commit.committer.date)
    const contentMatch = text.match(/---[\s\S]*?---\s*([\s\S]*)/)
    const content = contentMatch ? contentMatch[1].trim() : ""

    return (
        <div className='px-[20vw] max-h-full -mt-2'>
            <div className='float-right text-superlight text-right w-fit'>
                <h1>Last edited {edited}</h1>
                <h1>Published {created}</h1>
            </div>
            <div>
                <MarkdownRender MDstr={content} />
                <div className='hover:scale-[1.03] bg-dark rounded-lg p-[0.5vh] px-4 w-fit'>
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
